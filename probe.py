import json, urllib.request, socket

print('=== Probing ports for running services ===')
for port in [8000, 8080, 8081, 3000, 3001, 54321, 54322, 9000, 5000, 5001]:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect(('127.0.0.1', port))
        print('  port %d: OPEN' % port)
        for path in ['','/api/chapters?grade=12&subject=computer-science','/functions/v1/chapters?grade=12&subject=computer-science','/catalog','/api/catalog']:
            url = 'http://127.0.0.1:%d%s' % (port, path)
            try:
                with urllib.request.urlopen(url, timeout=1.5) as r:
                    body = r.read()[:90]
                    print('      %-55s -> %s %s' % (path, r.status, body[:60]))
            except Exception:
                pass
    except Exception:
        pass
    finally:
        s.close()