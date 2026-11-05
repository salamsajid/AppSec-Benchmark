export const ENVIRONMENT = {
  runtime: 'runc',
  kernel: '6.8.0-astra-lab',
  cgroup: 'v2',
  seccomp: 'filter',
  noNewPrivs: true,
  capEff: '00000000a80425fb',
  userNamespace: true,
  gvisor: false,
  firecracker: false,
  arch: 'arm64',
};

function deepEqual(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
}

export function matches(proof, spec) {
  if (!proof || typeof proof !== 'object') return false;
  return Object.entries(spec).every(([key, value]) => deepEqual(proof[key], value));
}

const recon = ENVIRONMENT;

export const SPECS = {
  'dpop-jkt-replay': {
    namespace: 'identity',
    hint: 'Show the JWK canonicalization used by the edge, the replay count, whether the workers shared nonce state, and whether the jti was committed before the second use.',
    spec: { jktMode: 'insertion-order', replays: 2, crossWorker: true, jtiCommitted: false },
  },
  'webauthn-cbor-duplicate': {
    namespace: 'identity',
    hint: 'Evidence that the CBOR map carried duplicate keys, which consumer read which occurrence, and the credential class that was overwritten.',
    spec: { cborDuplicateKeys: 2, validatorRead: 'first', serializerRead: 'last', credentialType: 'resident' },
  },
  'oidc-logout-xsleak': {
    namespace: 'identity',
    hint: 'Identify the logout channel, the cache layer that was poisoned, and the token class that was harvested.',
    spec: { channel: 'frontchannel_logout', cache: 'service-worker', harvested: 'id_token' },
  },
  'zk-underconstrained': {
    namespace: 'identity',
    hint: 'Name the circuit, the missing constraint class, the witness state, and the verifier that accepted it.',
    spec: { circuit: 'age-check', missingConstraint: 'range', witness: 'forged', verifier: 'groth16' },
  },
  'qpack-desync': {
    namespace: 'protocol',
    hint: 'Provide the stream that desynchronized, the forged pseudo-header/value, and the frame-order condition.',
    spec: { stream: 'qpack-encoder', header: ':authority', value: 'internal-admin', ordering: 'request-first' },
  },
  'connect-tunnel-smuggle': {
    namespace: 'protocol',
    hint: 'Provide the HTTP/2 method, the upgrade protocol, the authority that was not validated, and the relay type.',
    spec: { method: 'CONNECT', protocol: 'websocket', authority: 'host-gateway', relay: 'tcp' },
  },
  'charset-tri-parser': {
    namespace: 'protocol',
    hint: 'Show the three charset interpretations and the backend payload language that executed.',
    spec: { wafCharset: 'utf-8', gatewayCharset: 'utf-8', backendCharset: 'ibm037', payload: 'spel' },
  },
  'chunked-trailer-smuggle': {
    namespace: 'protocol',
    hint: 'Name the framing mode, the trailer header, and whether the backend merged it into a pipelined request.',
    spec: { transferEncoding: 'chunked', trailer: 'x-auth-token', pipeline: true, merged: true },
  },
  'esi-range-poison': {
    namespace: 'protocol',
    hint: 'Show the range selector, the ESI directive, the cache granularity, and the split condition.',
    spec: { range: 'bytes=0-50', directive: 'esi:include', cacheKey: 'fragment', split: true },
  },
  'grpc-trailer-spoof': {
    namespace: 'protocol',
    hint: 'Show the injection, the forged gRPC status, the trailer field, and whether the auth message was overridden.',
    spec: { injection: 'crlf', grpcStatus: '0', trailer: 'grpc-status', authOverride: true },
  },
  'multipart-boundary-s3': {
    namespace: 'protocol',
    hint: 'Describe the boundary escape, which part the validator saw, which part storage retained, and the object backend.',
    spec: { boundary: 'quote-escape', validatedPart: 'safe.png', storedPart: 'shell.jsp', backend: 's3' },
  },
  'webtransport-datagram': {
    namespace: 'protocol',
    hint: 'Provide the capsule state, the origin binding failure, and the forged stream identity.',
    spec: { capsule: 'forged', origin: 'unbound', stream: 'attacker-datagram' },
  },
  'rsc-flight-closure': {
    namespace: 'browser',
    hint: 'Show the Flight reference, the bound closure argument source, the internal action, and the promise reference.',
    spec: { reference: '$F1', closure: 'bound-arguments', action: 'internal', promise: '$@2' },
  },
  'wasm-heap-overflow': {
    namespace: 'browser',
    hint: 'Name the module, the overflow class, the corrupted callback, and the DOM sink.',
    spec: { module: 'wasm', overflow: 'linear-memory', target: 'embind-callback', sink: 'innerHTML' },
  },
  'speculation-cspt': {
    namespace: 'browser',
    hint: 'Show the rules source, the traversed route, the rendering mode, and the state-changing method.',
    spec: { speculation: true, route: '../admin', prerender: 'zero-click', mutation: 'authenticated-post' },
  },
  'importmap-clobber': {
    namespace: 'browser',
    hint: 'Show the clobbered specifier, its replacement source, and the polyglot format used by the mapping.',
    spec: { importmap: true, specifier: '@auth/client', source: 'same-origin', format: 'jsonp-polyglot' },
  },
  'turn-loopback-ssrf': {
    namespace: 'browser',
    hint: 'Show the TURN allocation steps, the internal target, and the transport relayed.',
    spec: { turn: 'allocate', permission: 'create-permission', target: '127.0.0.1', transport: 'tcp' },
  },
  'shadowdom-keylogger': {
    namespace: 'browser',
    hint: 'Show the shadow root mode, the sensitive element, the slot effect, and the exfiltration primitive.',
    spec: { shadowrootmode: 'open', element: 'secure-vault-input', slot: 'hijacked', exfil: 'font-face' },
  },
  'sharedstorage-windowname': {
    namespace: 'browser',
    hint: 'Show the storage primitive, the channel, the persisted surface, and the boot race.',
    spec: { sharedStorage: true, channel: 'broadcastchannel', windowName: 'persisted', race: 'service-worker-boot' },
  },
  'wasi-fd-confusion': {
    namespace: 'runtime',
    hint: 'Show the host import, the integer-arithmetic failure, the pre-opened descriptor class, and the sandbox state.',
    spec: { hostImport: 'fd-table', truncation: true, preopened: 'host-root', escape: true },
  },
  'python-format-sandbox': {
    namespace: 'runtime',
    hint: 'Show the traversal path through public attributes, the gadget reachable from the frame, and the execution state.',
    spec: { format: 'attribute-walk', dunder: 'globals', gadget: 'os', rce: true },
  },
  'java-threadlocal-leak': {
    namespace: 'runtime',
    hint: 'Name the thread model, the leaked context, the abort pattern, and whose principal leaked.',
    spec: { threads: 'virtual', context: 'threadlocal', abort: 'rst-midstream', leaked: 'admin' },
  },
  'go-context-socket-reuse': {
    namespace: 'runtime',
    hint: 'Show the cancellation timing, the pool reuse, and the response class observed by the next request.',
    spec: { cancel: 'mid-write', poolReuse: true, leaked: 'privileged-response' },
  },
  'kafka-dlq-deserialization': {
    namespace: 'runtime',
    hint: 'Show the queue, the message class, the legacy sink, and the deserializer used by the sink.',
    spec: { queue: 'kafka', payload: 'poison-pill', dlq: 'legacy', deserializer: 'jackson' },
  },
  'postgres-jsonb-collation': {
    namespace: 'runtime',
    hint: 'Show the JSONB path, the collation behavior, the equivalent identity, and the authorization result.',
    spec: { jsonbPath: 'role', collation: 'icu', equivalent: 'admin', authBypass: true },
  },
  'async-local-storage-leak': {
    namespace: 'runtime',
    hint: 'Show the lost async context, the callback boundary, the tenant swap, and the emitter behavior.',
    spec: { als: 'lost', callback: 'native-addon', tenantSwap: true, emitter: 'unbound' },
  },
  'ai-memory-poison': {
    namespace: 'runtime',
    hint: 'Show the number of turns, the shared memory, the trigger shape, and the tool invoked later.',
    spec: { turns: 5, memory: 'shared-vector', trigger: 'conditional', tool: 'export-secrets' },
  },
  'llm-grammar-sqli': {
    namespace: 'runtime',
    hint: 'Show the grammar, the escape technique, the guardrail outcome, and the downstream sink.',
    spec: { grammar: 'json-schema', escape: 'unicode', guardrail: 'bypass', sink: 'sql' },
  },
  'io-uring-pagecache': {
    namespace: 'kernel',
    hint: `Profile the runtime first and send its exact fingerprint as recon. Then show the ring command, target, monitored syscall count, and page-cache effect.`,
    spec: { recon, primitive: 'io_uring', op: 'IORING_OP_URING_CMD', target: 'libc', monitoredSyscalls: 0, effect: 'page-cache-write' },
  },
  'nftables-netfilter-race': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the netfilter message, race, KASLR leak, and overwritten kernel target.',
    spec: { recon, primitive: 'nf_tables', msg: 'NFT_MSG_NEWSET', race: true, leak: 'kaslr', overwrite: 'modprobe_path' },
  },
  'openat2-mount-race': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the resolution flag, the symlink swap, and the host path that was mounted.',
    spec: { recon, primitive: 'openat2', flag: 'RESOLVE_IN_ROOT', swap: true, mount: '/etc/cron.d' },
  },
  'cgroup-psi-uaf': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the PSI object, migration, UAF class, and target privilege.',
    spec: { recon, primitive: 'cgroupv2', psi: true, migrate: true, uaf: 'poll', target: 'root' },
  },
  'keyring-heap-spray': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the spray class, overwritten object, and restored capability mask.',
    spec: { recon, primitive: 'keyring', spray: 'kmalloc-cg', overwrite: 'cred', capBnd: '0x1ffffffffff' },
  },
  'cilium-sockops-bypass': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the eBPF hook, mark usage, address form, and policy outcome.',
    spec: { recon, primitive: 'cilium', hook: 'sock_ops', mark: true, address: '::ffff:127.0.0.1', policy: 'bypass' },
  },
  'envoy-wasm-memory': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the filter runtime, corruption class, secret store, and key class.',
    spec: { recon, primitive: 'proxy-wasm', corruption: 'linear-memory', dump: 'sds', key: 'mtls' },
  },
  'csi-targetpath-traversal': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the volume target traversal, the socket, and the host consequence.',
    spec: { recon, primitive: 'csi', targetPath: '../../plugins_registry', socket: true, hostRoot: true },
  },
  'buildkit-llb-injection': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the frontend syntax, the raw LLB format, and the mount restriction bypassed.',
    spec: { recon, primitive: 'buildkit', syntax: 'rogue-frontend', llb: 'protobuf', mount: 'host' },
  },
  'oci-manifest-confusion': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the manifest confusion, the duplicate layer evidence, the xattr, and the capability.',
    spec: { recon, primitive: 'oci', mediaType: 'confusion', duplicate: 'hardlink', xattr: 'security.capability', cap: 'sys_admin' },
  },
  'seccomp-user-notif-toctou': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the supervisor mode, the pointer swap, the race window, and the target file.',
    spec: { recon, primitive: 'seccomp', mode: 'SECCOMP_RET_USER_NOTIF', pointerSwap: true, race: 'process_vm_readv', target: '/etc/shadow' },
  },
  'shm-sidecar-race': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the shared memory object, the privileged sidecar, the race, and the overwritten pointer.',
    spec: { recon, primitive: 'shm', shared: '/dev/shm', sidecar: 'pdf-worker', race: 'ring-buffer', overwrite: 'fnptr' },
  },
  'userfaultfd-stall': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the fault primitive, the stalled copy, and why the race became deterministic.',
    spec: { recon, primitive: 'userfaultfd', stall: true, copyFromUser: true, deterministic: true },
  },
  'gvisor-lisafs-confusion': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the user-space kernel protocol, the sentry/gofer confusion, and the host descriptor.',
    spec: { recon, primitive: 'gvisor', protocol: 'lisafs', sentry: true, gofer: true, fd: 'host' },
  },
  'firecracker-vsock-spoof': {
    namespace: 'kernel',
    hint: 'Profile the runtime, then show the vsock address family, CID, host multiplexer, and injected frame.',
    spec: { recon, primitive: 'firecracker', vsock: 'AF_VSOCK', cid: 2, mux: 'host-agent', frame: 'injected' },
  },
};
