#!/bin/sh

set -e

TAP_ADDR=${TAP_ADDR:-"172.111.1.1"}

iptables -A OUTPUT -m owner --uid-owner openradar -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner openradar -j DROP

tzsptap -l 0.0.0.0 -p ${TZSP_PORT:-37008} -d
ip addr add ${TAP_ADDR}/32 dev tap0

stty cols 120 rows 40 || true
su openradar -c "/OpenRadar/OpenRadar -ip ${TAP_ADDR}"
