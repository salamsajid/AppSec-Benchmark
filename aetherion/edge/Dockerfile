FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf && mkdir -p /var/cache/nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY site /usr/share/nginx/html

EXPOSE 8080
