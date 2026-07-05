"""
Full VPS deployment script for Trello CRM Clone.
Connects via SSH, sets up server, uploads code, configures Nginx + systemd.
"""
import paramiko
import os
import sys
import tarfile
import io
import stat
import time

# ── Config ────────────────────────────────────────────────────────────────────
HOST = "46.37.122.138"
PORT = 22
USER = "root"
DOMAIN = "crm.welinkglobalsolutions.com"
APP_DIR = "/home/crm/app"
LOCAL_PROJECT = r"c:\New folder\Trello dev build"

# Load password from environment variable or prompt securely
PASSWORD = os.environ.get("VPS_PASSWORD")
if not PASSWORD:
    try:
        import getpass
        PASSWORD = getpass.getpass("Enter VPS SSH password (or set VPS_PASSWORD env var): ")
    except Exception:
        raise ValueError("VPS_PASSWORD environment variable must be set in non-interactive environments.")

# Load Django secret key from environment or generate a secure one dynamically
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_urlsafe(50)

# ── Helpers ───────────────────────────────────────────────────────────────────
def run(ssh, cmd, desc="", ignore_errors=False):
    print(f"\n{'='*60}")
    if desc:
        print(f"  {desc}")
    print(f"  $ {cmd[:100]}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip()[-500:])
    if err.strip() and not ignore_errors:
        print("STDERR:", err.strip()[-300:])
    if code != 0 and not ignore_errors:
        print(f"  [WARNING] exit code {code}")
    return out, err, code

def upload_tar(ssh, local_dir, remote_dir, excludes=None):
    """Create tarball in memory and stream it to the server."""
    excludes = excludes or []
    print(f"\n{'='*60}")
    print(f"  Uploading {local_dir} -> {remote_dir}")

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for root, dirs, files in os.walk(local_dir):
            # Filter excluded directories
            dirs[:] = [d for d in dirs if not any(
                ex in os.path.join(root, d) for ex in excludes
            )]
            for file in files:
                full_path = os.path.join(root, file)
                arcname = os.path.relpath(full_path, local_dir)
                if not any(ex in full_path for ex in excludes):
                    try:
                        tar.add(full_path, arcname=arcname)
                    except Exception:
                        pass

    buf.seek(0)
    data = buf.read()
    print(f"  Archive size: {len(data) / 1024 / 1024:.1f} MB")

    # Upload via SFTP
    sftp = ssh.open_sftp()
    remote_tar = f"/tmp/deploy_{int(time.time())}.tar.gz"
    with sftp.open(remote_tar, "wb") as f:
        f.write(data)
    sftp.close()

    # Extract on server
    run(ssh, f"mkdir -p {remote_dir} && tar -xzf {remote_tar} -C {remote_dir} && rm {remote_tar}",
        "Extracting archive")
    print("  Upload complete.")

def write_remote_file(ssh, path, content):
    """Write a text file directly on the remote server."""
    sftp = ssh.open_sftp()
    # Ensure directory exists
    dir_path = path.rsplit("/", 1)[0]
    try:
        sftp.makedirs = lambda p: None
        parts = dir_path.split("/")
        current = ""
        for part in parts:
            if not part:
                continue
            current += "/" + part
            try:
                sftp.stat(current)
            except FileNotFoundError:
                sftp.mkdir(current)
    except Exception:
        pass

    with sftp.open(path, "w") as f:
        f.write(content)
    sftp.close()
    print(f"  Wrote {path}")


# ── Main Deployment ───────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  TRELLO CRM — VPS DEPLOYMENT")
print(f"  Target: {USER}@{HOST}")
print(f"  Domain: {DOMAIN}")
print("="*60)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print("\nConnecting to server...")
try:
    ssh.connect(HOST, PORT, USER, PASSWORD, timeout=30,
                look_for_keys=False, allow_agent=False)
except paramiko.ssh_exception.AuthenticationException:
    # Try keyboard-interactive auth
    transport = paramiko.Transport((HOST, PORT))
    transport.connect()
    transport.auth_interactive(USER, lambda title, instructions, fields: [PASSWORD] * len(fields))
    ssh._transport = transport
print("  Connected!")

# ── 1. System packages ────────────────────────────────────────────────────────
run(ssh, "apt-get update -qq", "Updating package list")
run(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip python3-venv git nginx nodejs npm",
    "Installing system packages")

# ── 2. Create crm user & directories ─────────────────────────────────────────
run(ssh, "id crm || useradd -m -s /bin/bash crm", "Creating crm user", ignore_errors=True)
run(ssh, f"mkdir -p {APP_DIR}/backend {APP_DIR}/frontend", "Creating app directories")
run(ssh, f"chown -R crm:crm /home/crm", "Setting ownership")

# ── 3. Upload backend (excluding venv, __pycache__, *.pyc) ───────────────────
backend_excludes = ["venv", "__pycache__", ".pyc", ".git", "node_modules", "staticfiles"]
upload_tar(ssh,
           os.path.join(LOCAL_PROJECT, "backend"),
           f"{APP_DIR}/backend",
           excludes=backend_excludes)

# ── 4. Upload React build (already built locally) ─────────────────────────────
frontend_build = os.path.join(LOCAL_PROJECT, "frontend", "build")
if os.path.exists(frontend_build):
    upload_tar(ssh, frontend_build, f"{APP_DIR}/frontend/build")
else:
    print("\n  WARNING: frontend/build not found — run start.bat first to build React")
    sys.exit(1)

# ── 5. Upload existing SQLite database ───────────────────────────────────────
db_path = os.path.join(LOCAL_PROJECT, "backend", "db.sqlite3")
if os.path.exists(db_path):
    print(f"\n{'='*60}")
    print("  Uploading SQLite database...")
    sftp = ssh.open_sftp()
    sftp.put(db_path, f"{APP_DIR}/backend/db.sqlite3")
    sftp.close()
    print("  Database uploaded.")
else:
    print("  No db.sqlite3 found — will create fresh on first migrate")

# ── 6. Python virtual environment & dependencies ──────────────────────────────
run(ssh, f"python3 -m venv {APP_DIR}/backend/venv", "Creating Python venv")
run(ssh, f"{APP_DIR}/backend/venv/bin/pip install -q --upgrade pip", "Upgrading pip")
run(ssh, f"{APP_DIR}/backend/venv/bin/pip install -q -r {APP_DIR}/backend/requirements.txt",
    "Installing Python dependencies")

# ── 7. Write .env file ────────────────────────────────────────────────────────
env_content = f"""DJANGO_SECRET_KEY={SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,{DOMAIN},www.{DOMAIN}
DJANGO_CORS_ALLOWED_ORIGINS=https://{DOMAIN}
DJANGO_DB_ENGINE=django.db.backends.sqlite3
DJANGO_DB_NAME={APP_DIR}/backend/db.sqlite3
DJANGO_CHANNEL_BACKEND=memory
DJANGO_REDIS_URL=redis://localhost:6379/0
"""
write_remote_file(ssh, f"{APP_DIR}/backend/.env", env_content)

# ── 8. Migrate & collectstatic ────────────────────────────────────────────────
migrate_cmd = (
    f"cd {APP_DIR}/backend && "
    f"export $(grep -v '^#' .env | xargs) && "
    f"venv/bin/python manage.py migrate --noinput && "
    f"venv/bin/python manage.py collectstatic --noinput"
)
run(ssh, migrate_cmd, "Running migrate + collectstatic")

# ── 9. Fix permissions ─────────────────────────────────────────────────────────
run(ssh, f"chown -R crm:crm {APP_DIR}", "Fixing file permissions")
run(ssh, f"chmod 644 {APP_DIR}/backend/db.sqlite3", "Fixing DB permissions", ignore_errors=True)

# ── 10. Systemd service ───────────────────────────────────────────────────────
service_content = f"""[Unit]
Description=Trello CRM - Daphne ASGI
After=network.target

[Service]
User=crm
Group=crm
WorkingDirectory={APP_DIR}/backend
EnvironmentFile={APP_DIR}/backend/.env
ExecStart={APP_DIR}/backend/venv/bin/daphne -b 127.0.0.1 -p 8000 config.asgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
write_remote_file(ssh, "/etc/systemd/system/crm.service", service_content)
run(ssh, "systemctl daemon-reload && systemctl enable crm && systemctl restart crm",
    "Starting systemd service")
time.sleep(3)
run(ssh, "systemctl status crm --no-pager", "Checking service status")

# ── 11. Nginx configuration ───────────────────────────────────────────────────
nginx_content = f"""upstream daphne {{
    server 127.0.0.1:8000;
}}

server {{
    listen 80;
    server_name {DOMAIN};
    client_max_body_size 50M;

    location /static/ {{
        alias {APP_DIR}/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }}

    location /media/ {{
        alias {APP_DIR}/backend/media/;
        expires 7d;
    }}

    location /ws/ {{
        proxy_pass http://daphne;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }}

    location / {{
        proxy_pass http://daphne;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
write_remote_file(ssh, "/etc/nginx/sites-available/crm", nginx_content)
run(ssh, "rm -f /etc/nginx/sites-enabled/default", "Removing default Nginx site", ignore_errors=True)
run(ssh, "ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm", "Enabling Nginx site")
run(ssh, "nginx -t", "Testing Nginx config")
run(ssh, "systemctl restart nginx", "Restarting Nginx")

# ── 12. Firewall ──────────────────────────────────────────────────────────────
run(ssh, "ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable",
    "Configuring firewall", ignore_errors=True)

# ── 13. SSL via Certbot ───────────────────────────────────────────────────────
run(ssh, "apt-get install -y -qq certbot python3-certbot-nginx", "Installing Certbot")
ssl_cmd = (
    f"certbot --nginx -d {DOMAIN} "
    f"--non-interactive --agree-tos --email admin@welinkglobalsolutions.com "
    f"--redirect --expand"
)
run(ssh, ssl_cmd, "Obtaining SSL certificate")

# ── Done ──────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  DEPLOYMENT COMPLETE!")
print(f"  App URL: https://{DOMAIN}")
print(f"\n  IMPORTANT: Change your root SSH password now:")
print(f"  Run on server: passwd")
print("="*60 + "\n")

ssh.close()
