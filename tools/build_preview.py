"""Build a single-file Claude artifact preview of the site from public/.

Usage: python3 tools/build_preview.py OUTPUT.html
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
pub = root / "public"
html = (pub / "index.html").read_text()
css = (pub / "styles.css").read_text()
strip = lambda s: re.sub(r"^export\s+", "", s, flags=re.M)
stories = strip((pub / "js" / "stories.js").read_text()).replace("const STORIES=", "const S=", 1)
prompts = strip((pub / "js" / "prompts.js").read_text())
app = (root / "tools" / "preview-app.js").read_text()

body = re.search(r"<body>(.*?)<script", html, re.S).group(1)
body = body.replace('<div class="wrap">', '<div class="wrap" dir="rtl" lang="ar">', 1)
banner = ('<p class="note" style="background:var(--gold-soft);color:var(--gold);border-radius:12px;padding:8px 12px;margin:0">'
          'معاينة داخل Claude: تسجيل الدخول هنا تجريبي، والأجوبة من Claude بالقواعد نفسها دون بحث Google. '
          'الموقع الحقيقي على seerah.live يستخدم Firebase وGemini.</p>')
body = body.replace("</header>", "</header>\n  " + banner, 1)

out = f"""<title>حكايات السيرة للأطفال</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@400;500;600;700&display=swap">
<style>
{css}</style>
{body}
<script>
{stories}
{prompts}
{app}
</script>
"""
pathlib.Path(sys.argv[1]).write_text(out)
print("wrote", sys.argv[1])
