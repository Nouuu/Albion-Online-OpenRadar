FROM debian:bookworm AS builder

ARG TZSPTAP_REPO_COMMIT=61f13bf

RUN apt-get update && apt-get install -y git build-essential
RUN git clone https://github.com/0xc0decafe/tzsptap.git \
    && cd tzsptap \
    && git checkout $TZSPTAP_REPO_COMMIT
RUN cd tzsptap && gcc -o tzsptap -Wall tzsptap.c

FROM debian:bookworm-slim

ARG OPENRADAR_VERSION=2.2.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    libpcap0.8 \
    libcap2-bin \
    iproute2 \
    iptables && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /tzsptap/tzsptap /usr/local/bin/tzsptap

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN useradd -u 10001 -m openradar
RUN mkdir -p /OpenRadar && chown -R openradar:openradar /OpenRadar
RUN wget https://github.com/Nouuu/Albion-Online-OpenRadar/releases/download/${OPENRADAR_VERSION}/OpenRadar-linux-amd64 -O /OpenRadar/OpenRadar
RUN chmod +x /OpenRadar/OpenRadar
RUN setcap cap_net_raw,cap_net_admin=eip /OpenRadar/OpenRadar

EXPOSE 5001
EXPOSE 37008/udp

ENTRYPOINT [ "/entrypoint.sh" ]
