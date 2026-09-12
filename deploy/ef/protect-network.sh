#!/bin/sh
set -eu
# This dedicated VM's Docker networks contain only AA-PQ/Kurtosis services.
# Keep container RPCs private without changing EF's host firewall policies.
iptables -N AA_PQ_PRIVATE 2>/dev/null || true
iptables -C AA_PQ_PRIVATE -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN 2>/dev/null || iptables -A AA_PQ_PRIVATE -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for network in bridge kt-aa-pq; do
  for subnet in $(docker network inspect "$network" --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'); do
    case "$subnet" in *:*) continue ;; esac
    iptables -C AA_PQ_PRIVATE -d "$subnet" -j DROP 2>/dev/null || iptables -A AA_PQ_PRIVATE -d "$subnet" -j DROP
  done
done
for interface in eth0 eth1; do
  iptables -C DOCKER-USER -i "$interface" -j AA_PQ_PRIVATE 2>/dev/null || iptables -I DOCKER-USER 1 -i "$interface" -j AA_PQ_PRIVATE
done
iptables -C INPUT ! -i lo -p tcp --dport 4337 -j REJECT 2>/dev/null || iptables -I INPUT 1 ! -i lo -p tcp --dport 4337 -j REJECT
