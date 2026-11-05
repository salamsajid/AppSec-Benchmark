package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	backendAddr = "127.0.0.1:8091"
	proxyAddr   = ":8090"
)

type pooledConn struct {
	conn   net.Conn
	reader *bufio.Reader
}

type connPool struct {
	mu   sync.Mutex
	idle *pooledConn
}

func (p *connPool) get() (*pooledConn, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.idle != nil {
		pc := p.idle
		p.idle = nil
		return pc, nil
	}
	return dialBackend()
}

func (p *connPool) getFresh() (*pooledConn, error) {
	p.mu.Lock()
	if p.idle != nil {
		p.idle.conn.Close()
		p.idle = nil
	}
	p.mu.Unlock()
	return dialBackend()
}

func dialBackend() (*pooledConn, error) {
	conn, err := net.DialTimeout("tcp", backendAddr, 2*time.Second)
	if err != nil {
		return nil, err
	}
	return &pooledConn{conn: conn, reader: bufio.NewReader(conn)}, nil
}

func (p *connPool) put(pc *pooledConn) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.idle != nil {
		pc.conn.Close()
		return
	}
	p.idle = pc
}

func backend() {
	mux := http.NewServeMux()
	mux.HandleFunc("/backend/admin", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "text/plain")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "internal-admin-profile\n"+os.Getenv("FLAG_GO")+"\n")
	})
	mux.HandleFunc("/backend/public", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "text/plain")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "public-profile\n")
	})
	server := &http.Server{Addr: backendAddr, Handler: mux}
	log.Fatal(server.ListenAndServe())
}

func readHeaders(reader *bufio.Reader) error {
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		if line == "\r\n" {
			return nil
		}
	}
}

func main() {
	health := flag.Bool("health", false, "check the proxy")
	flag.Parse()
	if *health {
		client := http.Client{Timeout: 2 * time.Second}
		resp, err := client.Get("http://127.0.0.1:8090/health")
		if err != nil {
			os.Exit(1)
		}
		defer resp.Body.Close()
		io.Copy(io.Discard, resp.Body)
		if resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}

	go backend()
	time.Sleep(100 * time.Millisecond)

	pool := &connPool{}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		fmt.Fprint(w, `{"service":"astralane-go-targets","status":"ok"}`)
	})
	mux.HandleFunc("/fetch", func(w http.ResponseWriter, r *http.Request) {
		abort := r.URL.Query().Get("abort") == "1"
		var pc *pooledConn
		var err error
		if abort {
			pc, err = pool.getFresh()
		} else {
			pc, err = pool.get()
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		path := "/backend/public"
		if abort {
			path = "/backend/admin"
		}
		if _, err := fmt.Fprintf(pc.conn, "GET %s HTTP/1.1\r\nHost: backend\r\nConnection: keep-alive\r\n\r\n", path); err != nil {
			pc.conn.Close()
			http.Error(w, "backend write failed", http.StatusBadGateway)
			return
		}
		if abort {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			done := make(chan error, 1)
			go func() { done <- readHeaders(pc.reader) }()
			select {
			case err := <-done:
				if err != nil {
					pc.conn.Close()
					http.Error(w, "backend header read failed", http.StatusBadGateway)
					return
				}
			case <-ctx.Done():
				pc.conn.Close()
				http.Error(w, "backend timeout", http.StatusGatewayTimeout)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			pool.put(pc)
			return
		}
		buf := make([]byte, 8192)
		pc.conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		n, err := pc.reader.Read(buf)
		if err != nil && n == 0 {
			pc.conn.Close()
			http.Error(w, "backend read failed", http.StatusBadGateway)
			return
		}
		pc.conn.SetReadDeadline(time.Time{})
		w.Header().Set("content-type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write(buf[:n])
		pool.put(pc)
	})

	log.Printf("astralane go target listening on %s", proxyAddr)
	log.Fatal(http.ListenAndServe(proxyAddr, mux))
}
