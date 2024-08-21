+++
title = 'How to Set Up ProtonVPN Free with WireGuard on Arch Linux'
date = 2024-08-21
draft = false
+++

In this guide, you'll learn how to set up ProtonVPN Free using WireGuard on Arch Linux. We'll also cover how to disable IPv6 to prevent potential IP leaks.

## Step 1: Install Required Packages

First, install the necessary packages for WireGuard:

```bash
sudo pacman -S wireguard-tools resolvconf
```

## Step 2: Access ProtonVPN Dashboard

Log in to your ProtonVPN account via the [ProtonVPN dashboard](https://account.protonvpn.com).

## Step 3: Download WireGuard Configuration Files

1. Navigate to the **Downloads** section in your ProtonVPN dashboard.
2. Under **WireGuard configuration**, select **Free** and download the configuration files for the servers you want to connect to. The files will have a `.conf` extension.

## Step 4: Set Up the WireGuard Configuration

Move the downloaded configuration files to the `/etc/wireguard/` directory:

```bash
sudo mv /path/to/downloaded/configs/*.conf /etc/wireguard/
```

Ensure that only the root user can access these files:

```bash
sudo chmod 600 /etc/wireguard/*.conf
```

## Step 5: Connect to ProtonVPN via WireGuard

To start a connection, use the following command (replace `server-name` with the actual name of the configuration file, excluding the `.conf` extension):

```bash
sudo wg-quick up /etc/wireguard/server-name
```

For example, if the configuration file is named `us-free-01.conf`, the command would be:

```bash
sudo wg-quick up us-free-01
```

## Step 6: Verify Your IP Address

Visit [ip.me](https://ip.me) to check your IP address. Make sure it matches the location of the VPN server you selected.

### Handling IPv6 Leaks

If your IPv4 traffic is routed through the VPN but your IPv6 traffic shows your real location, follow these steps:

#### Step 7: Disable IPv6 (Only If Leaking)

**Temporary Disable (until reboot):**

```bash
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1
```

**Permanent Disable:**

1. Edit or create the configuration file `/etc/sysctl.d/99-sysctl.conf`:

   ```bash
   sudo nano /etc/sysctl.d/99-sysctl.conf
   ```

2. Add the following lines:

   ```bash
   net.ipv6.conf.all.disable_ipv6 = 1
   net.ipv6.conf.default.disable_ipv6 = 1
   ```

3. Apply the changes:

   ```bash
   sudo sysctl -p /etc/sysctl.d/99-sysctl.conf
   ```

## Step 8: Disconnect from ProtonVPN

To disconnect, use:

```bash
sudo wg-quick down server-name
```

## Step 9: Recheck for Leaks

After applying the changes, reconnect to the VPN and check your IP again using [ipleak.net](https://ipleak.net) to ensure no IPv6 addresses are leaking.

## Conclusion

You've successfully set up ProtonVPN Free using WireGuard on Arch Linux and protected your privacy by ensuring that your IPv6 traffic doesn't leak your real location.

If you found this guide helpful, feel free to share it with others who might benefit from a secure and private internet experience!
