#!/usr/bin/env bash

# Source .bashrc, since the default .profile we're replacing did so.
# shellcheck source=/dev/null
. "$HOME/.bashrc"

# Hack to avoid servers having to bind to 0.0.0.0 to be accessible from the VM host (bug 1362443).
# This is still secure so long as the Vagrantfile port forwarding uses a `host_ip` of `127.0.0.1`.
# To prevent this "Martian packet" traffic from being blocked, `route_localnet` has to enabled. See:
# https://unix.stackexchange.com/questions/111433/iptables-redirect-outside-requests-to-127-0-0-1
# By default neither sysctl or iptables settings are persisted across reboots, and fixing that
# requires a bizarre amount of complexity (installing iptables-persistent and then more boilerplate).
# As such, it's just easier to re-run the commands on each login since they take <30ms.
sudo sysctl -q -w net.ipv4.conf.all.route_localnet=1
sudo iptables -t nat --flush
# Using `e+` wildcard to handle all possible variations of ethernet adapter name, since it can be
# either `enp0s3` or `eth0`depending on Bento image version:
# https://github.com/chef/bento/pull/900#issuecomment-344297489
sudo iptables -t nat -A PREROUTING -i e+ -p tcp -j DNAT --to 127.0.0.1

PS1='\[\e[0;31m\]\u\[\e[m\] \[\e[1;34m\]\w\[\e[m\] \$ '
echo "Type 'thelp' to see a list of Treeherder-specific helper aliases"
cd "$HOME/treeherder" || return 1

# Helper aliases

alias npm='echo "Please use yarn instead of npm to ensure yarn.lock stays in sync!"'

function thelp {
    echo "
    Treeherder-specific helpful aliases:

    thpurge            - Empty all databases and reset all queues (requires vagrant provision afterward)
    thqueues           - Output the status of the Treeherder celery queues
    thqueuespurge      - Empty all the treeherder celery queues
    threstartrabbitmq  - Restart rabbitmq
    thresetall         - Delete logs, purge queues and clear cache
    "
}

function thqueues {
    # list the treeherder queue sizes

    sudo rabbitmqctl list_queues
}

function thqueuespurge {
    # purge the celery queues

    celery -A treeherder purge
}

function threstartrabbitmq {
    echo "Restarting rabbitmq"
    sudo systemctl restart rabbitmq-server.service
}

function thresetall {
    "${HOME}/treeherder/manage.py" clear_cache
    threstartrabbitmq

    echo "Purging queues"
    thqueuespurge
}

function thpurge {
    ~/treeherder/manage.py flush
    thresetall
    echo
    echo "Please exit vagrant and run 'vagrant provision' to finish"
}
