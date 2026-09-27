# Albion-Online-OpenRadar docker container with TZSP reciever

Can be run on a separate machine, receives sniffed traffic via the [TaZmen Sniffer Protocol (TZSP)](https://en.wikipedia.org/wiki/TZSP).

# Usage

```
docker compose build
docker compose up -d
```

Environmental variables:

- `TZSP_PORT` - TZSP receiver listening port (default: 37008)
- `TAP_ADDR` - custom address for tap interface (default: 172.111.1.1)

# Traffic capture and forwarding using TZSP
## Mikrotik

```
/ip firewall mangle
add action=sniff-tzsp chain=prerouting port=5056 protocol=udp sniff-target=192.168.10.10 sniff-target-port=37008
```

## OpenWRT

[port-mirroring](https://openwrt.org/packages/pkgdata/port-mirroring) package

`/etc/config/port-mirroring`
```
config 'port-mirroring'
    option source_ports 'eth1'
    option promiscuous  '0'
    option target       '192.168.10.10'
    option protocol     'TZSP'
    option filter       'udp port 5056'
```

## Windows

[go_send_tzsp](https://github.com/BoredHackerBlog/go_send_tzsp) (requires [Npcap](https://npcap.com/#download))

```
./go_send_tzsp.exe -iface "\Device\NPF_{B9A2AD14-3392-4BF0-8DC5-894E4EB6463F}" -dstip 192.168.10.10 -dstport 37008 -filter "udp port 5056"
```
You can obtain interface GUID by `Get-NetAdapter | Select Name, InterfaceGuid`
