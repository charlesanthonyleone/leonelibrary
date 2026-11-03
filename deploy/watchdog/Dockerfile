FROM alpine:3.20
RUN apk add --no-cache git openssh-client curl && adduser -D -u 1000 wd
COPY watch.sh /watch.sh
USER wd
CMD ["sh", "/watch.sh"]
