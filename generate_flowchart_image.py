from PIL import Image, ImageDraw, ImageFont

width, height = 2000, 1300
img = Image.new('RGB', (width, height), color='#F8FAFC')
draw = ImageDraw.Draw(img)

# Try loading bold/larger Arial fonts
try:
    font_title_bold = ImageFont.truetype("arialbd.ttf", 24)
    font_bold = ImageFont.truetype("arialbd.ttf", 20)
    font_item = ImageFont.truetype("arial.ttf", 17)
    font_small = ImageFont.truetype("arial.ttf", 16)
except Exception:
    font_title_bold = ImageFont.load_default()
    font_bold = ImageFont.load_default()
    font_item = ImageFont.load_default()
    font_small = ImageFont.load_default()

def draw_card(x, y, w, h, title, sub="", items=[], header_color="#1E3A8A"):
    # Main outer container
    draw.rounded_rectangle([x, y, x+w, y+h], radius=14, fill="#FFFFFF", outline="#CBD5E1", width=3)
    
    # Header bar
    header_h = 56 if sub else 50
    draw.rounded_rectangle([x, y, x+w, y+header_h], radius=14, fill=header_color)
    draw.rectangle([x, y+24, x+w, y+header_h], fill=header_color) # square bottom corners of header
    
    # Title text
    draw.text((x + w/2, y + 16), title, fill="#FFFFFF", font=font_title_bold, anchor="mm")
    if sub:
        draw.text((x + w/2, y + 40), sub, fill="#93C5FD", font=font_small, anchor="mm")
    
    # Bullet items
    if items:
        iy = y + header_h + 20
        for item in items:
            draw.text((x + 24, iy), f"•  {item}", fill="#1E293B", font=font_item)
            iy += 36

def draw_arrow(x1, y1, x2, y2, color="#475569"):
    draw.line([x1, y1, x2, y2], fill=color, width=4)
    if y2 > y1 and x1 == x2:
        draw.polygon([(x2-8, y2-14), (x2+8, y2-14), (x2, y2)], fill=color)

def draw_h_connector(x1, y1, x2, y2, mid_y, color="#475569"):
    draw.line([x1, y1, x1, mid_y], fill=color, width=4)
    draw.line([x1, mid_y, x2, mid_y], fill=color, width=4)
    draw.line([x2, mid_y, x2, y2], fill=color, width=4)
    draw.polygon([(x2-8, y2-14), (x2+8, y2-14), (x2, y2)], fill=color)

# 1. Top Auth Card
draw_card(750, 40, 500, 85, "Landing / Auth Page", "(index.html)", header_color="#1E3A8A")

# Connectors from Top to User & Admin Creds
draw_h_connector(1000, 125, 500, 240, 180)
draw_h_connector(1000, 125, 1500, 240, 180)

# 2. User Credentials & Admin Credentials
draw_card(300, 240, 400, 60, "User Credentials", header_color="#2563EB")
draw_card(1300, 240, 400, 60, "Admin Credentials", header_color="#0D9488")

# Arrow from Creds to Dashboards
draw_arrow(500, 300, 500, 390)
draw_arrow(1500, 300, 1500, 390)

# 3. Dashboards
draw_card(275, 390, 450, 85, "User Dashboard", "(dashboard.html)", header_color="#1E3A8A")
draw_card(1275, 390, 450, 85, "Admin Dashboard", "(/admin/index.html)", header_color="#0F172A")

# Connectors from Dashboards to Modules
draw_h_connector(500, 475, 250, 590, 530)
draw_h_connector(500, 475, 750, 590, 530)

draw_h_connector(1500, 475, 1250, 590, 530)
draw_h_connector(1500, 475, 1750, 590, 530)

# 4. Modules
draw_card(30, 590, 440, 290, "Daily Journey", header_color="#2563EB", items=[
    "Daily Mood Check-in",
    "Scenario Assessment (1-5)",
    "Real-time Face Check",
    "Visual Reflections",
    "Reflection Journaling"
])

draw_card(530, 590, 440, 290, "Insights & Reports", header_color="#2563EB", items=[
    "Mood & Energy Trends",
    "Streak & History Badges",
    "Personal PDF Exports",
    "Historical Reflections"
])

draw_card(1030, 590, 440, 290, "Care Panel", header_color="#0D9488", items=[
    "Watchlist Monitoring",
    "Soft Dashboard Nudge",
    "Case Log Records",
    "Attention Indicators"
])

draw_card(1530, 590, 440, 290, "Scenario Bank", header_color="#0D9488", items=[
    "Create / Edit Scenario",
    "Toggle Scenario Active",
    "Global Completion Stats",
    "50 Scenario Repository"
])

img.save("flowchart_diagram.png")
print("Successfully regenerated flowchart_diagram.png with larger crisp text")
