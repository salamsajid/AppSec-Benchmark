#!/usr/bin/env python3
import os
import sys
import json
import time
import urllib.request
import urllib.parse

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "services", "spa", "public", "vehicles")
os.makedirs(PUBLIC_DIR, exist_ok=True)

# 30 vehicles with primary Wikipedia page titles
CARS = [
  {"id": 1, "make": "Toyota", "model": "Corolla", "wiki": "Toyota Corolla", "rear": "Toyota Corolla rear", "interior": "Toyota Corolla interior"},
  {"id": 2, "make": "Honda", "model": "Civic", "wiki": "Honda Civic", "rear": "Honda Civic sedan rear", "interior": "Honda Civic interior"},
  {"id": 3, "make": "Ford", "model": "Mustang", "wiki": "Ford Mustang (first generation)", "rear": "1967 Ford Mustang rear", "interior": "1967 Ford Mustang interior"},
  {"id": 4, "make": "Tesla", "model": "Model 3", "wiki": "Tesla Model 3", "rear": "Tesla Model 3 rear", "interior": "Tesla Model 3 interior"},
  {"id": 5, "make": "Hyundai", "model": "Creta", "wiki": "Hyundai Creta", "rear": "Hyundai Creta rear", "interior": "Hyundai Creta interior"},
  {"id": 6, "make": "Maruti Suzuki", "model": "Swift", "wiki": "Suzuki Swift", "rear": "Suzuki Swift rear", "interior": "Suzuki Swift interior"},
  {"id": 7, "make": "Mahindra", "model": "Thar", "wiki": "Mahindra Thar", "rear": "Mahindra Thar rear", "interior": "Mahindra Thar interior"},
  {"id": 8, "make": "Tata", "model": "Nexon EV", "wiki": "Tata Nexon", "rear": "Tata Nexon rear", "interior": "Tata Nexon interior"},
  {"id": 9, "make": "Kia", "model": "Seltos", "wiki": "Kia Seltos", "rear": "Kia Seltos rear", "interior": "Kia Seltos interior"},
  {"id": 10, "make": "Toyota", "model": "Fortuner", "wiki": "Toyota Fortuner", "rear": "Toyota Fortuner rear", "interior": "Toyota Fortuner interior"},
  {"id": 11, "make": "Honda", "model": "City", "wiki": "Honda City", "rear": "Honda City sedan rear", "interior": "Honda City interior"},
  {"id": 12, "make": "Maruti Suzuki", "model": "Baleno", "wiki": "Suzuki Baleno", "rear": "Suzuki Baleno rear", "interior": "Suzuki Baleno interior"},
  {"id": 13, "make": "Hyundai", "model": "Verna", "wiki": "Hyundai Accent", "rear": "Hyundai Accent rear", "interior": "Hyundai Accent interior"},
  {"id": 14, "make": "Tata", "model": "Harrier", "wiki": "Tata Harrier", "rear": "Tata Harrier rear", "interior": "Tata Harrier interior"},
  {"id": 15, "make": "MG", "model": "Hector", "wiki": "Baojun 530", "rear": "Baojun 530 rear", "interior": "Baojun 530 interior"},
  {"id": 16, "make": "Skoda", "model": "Kushaq", "wiki": "Škoda Kushaq", "rear": "Skoda Kushaq rear", "interior": "Skoda Kushaq interior"},
  {"id": 17, "make": "Volkswagen", "model": "Virtus", "wiki": "Volkswagen Virtus", "rear": "Volkswagen Virtus rear", "interior": "Volkswagen Virtus interior"},
  {"id": 18, "make": "Jeep", "model": "Compass", "wiki": "Jeep Compass", "rear": "Jeep Compass rear", "interior": "Jeep Compass interior"},
  {"id": 19, "make": "Nissan", "model": "Magnite", "wiki": "Nissan Magnite", "rear": "Nissan Magnite rear", "interior": "Nissan Magnite interior"},
  {"id": 20, "make": "Renault", "model": "Kiger", "wiki": "Renault Kiger", "rear": "Renault Kiger rear", "interior": "Renault Kiger interior"},
  {"id": 21, "make": "BMW", "model": "3 Series", "wiki": "BMW 3 Series", "rear": "BMW 3 Series sedan rear", "interior": "BMW 3 Series interior"},
  {"id": 22, "make": "Mercedes-Benz", "model": "C-Class", "wiki": "Mercedes-Benz C-Class", "rear": "Mercedes-Benz C-Class rear", "interior": "Mercedes-Benz C-Class interior"},
  {"id": 23, "make": "Audi", "model": "A4", "wiki": "Audi A4", "rear": "Audi A4 sedan rear", "interior": "Audi A4 interior"},
  {"id": 24, "make": "Toyota", "model": "Innova Crysta", "wiki": "Toyota Innova", "rear": "Toyota Innova Crysta rear", "interior": "Toyota Innova interior"},
  {"id": 25, "make": "Mahindra", "model": "XUV700", "wiki": "Mahindra XUV700", "rear": "Mahindra XUV700 rear", "interior": "Mahindra XUV700 interior"},
  {"id": 26, "make": "Tata", "model": "Altroz", "wiki": "Tata Altroz", "rear": "Tata Altroz rear", "interior": "Tata Altroz interior"},
  {"id": 27, "make": "Honda", "model": "Amaze", "wiki": "Honda Amaze", "rear": "Honda Amaze rear", "interior": "Honda Amaze interior"},
  {"id": 28, "make": "Hyundai", "model": "i20", "wiki": "Hyundai i20", "rear": "Hyundai i20 rear", "interior": "Hyundai i20 interior"},
  {"id": 29, "make": "Kia", "model": "Sonet", "wiki": "Kia Sonet", "rear": "Kia Sonet rear", "interior": "Kia Sonet interior"},
  {"id": 30, "make": "Maruti Suzuki", "model": "Dzire", "wiki": "Suzuki Dzire", "rear": "Suzuki Dzire rear", "interior": "Suzuki Dzire interior"}
]

HEADERS = {"User-Agent": "UsedVehiclePlatform/1.0 (Mozilla/5.0; student@lab.local)"}

def fetch_wiki_thumbnails(titles):
    pipe_titles = "|".join([urllib.parse.quote(t) for t in titles])
    url = f"https://en.wikipedia.org/w/api.php?action=query&titles={pipe_titles}&prop=pageimages&format=json&pithumbsize=800"
    req = urllib.request.Request(url, headers=HEADERS)
    res = json.loads(urllib.request.urlopen(req, timeout=15).read())
    pages = res.get("query", {}).get("pages", {})
    mapping = {}
    for pid, page in pages.items():
        title = page.get("title")
        thumb = page.get("thumbnail", {}).get("source")
        if title and thumb:
            mapping[title] = thumb
    return mapping

def search_commons_image(query):
    try:
        url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query)}&srnamespace=6&format=json"
        req = urllib.request.Request(url, headers=HEADERS)
        res = json.loads(urllib.request.urlopen(req, timeout=10).read())
        hits = [x["title"] for x in res.get("query", {}).get("search", []) if not x["title"].lower().endswith(".pdf") and not x["title"].lower().endswith(".svg")]
        if not hits:
            return None
        title = hits[0]
        t_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json"
        req2 = urllib.request.Request(t_url, headers=HEADERS)
        res2 = json.loads(urllib.request.urlopen(req2, timeout=10).read())
        pages = res2.get("query", {}).get("pages", {})
        for p in pages.values():
            thumb = p.get("imageinfo", [{}])[0].get("thumburl")
            if thumb:
                return thumb
    except Exception as e:
        print(f"Error searching {query}: {e}")
    return None

def download_file(url, target_path):
    if not url:
        return False
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        data = urllib.request.urlopen(req, timeout=15).read()
        if len(data) > 1000:
            with open(target_path, "wb") as f:
                f.write(data)
            return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
    return False

def main():
    print("Fetching primary thumbnails from Wikipedia...")
    wiki_titles = [c["wiki"] for c in CARS]
    wiki_thumbs = fetch_wiki_thumbnails(wiki_titles)
    print(f"Got {len(wiki_thumbs)} primary thumbnails.")

    car_image_data = {}

    for car in CARS:
        cid = car["id"]
        primary_url = wiki_thumbs.get(car["wiki"])
        if not primary_url:
            for k, v in wiki_thumbs.items():
                if k.lower() == car["wiki"].lower():
                    primary_url = v
                    break

        print(f"Downloading vehicle {cid}: {car['make']} {car['model']}...")
        
        # Primary photo (0)
        p0_path = os.path.join(PUBLIC_DIR, f"{cid}-0.jpg")
        p_main_path = os.path.join(PUBLIC_DIR, f"{cid}.jpg")
        success_0 = download_file(primary_url, p0_path)
        if success_0:
            with open(p0_path, "rb") as rf, open(p_main_path, "wb") as wf:
                wf.write(rf.read())
        else:
            print(f"  Warning: failed primary download for {cid}")

        # Secondary photo (1: rear)
        p1_path = os.path.join(PUBLIC_DIR, f"{cid}-1.jpg")
        rear_url = search_commons_image(car["rear"])
        success_1 = download_file(rear_url, p1_path)
        if not success_1 and success_0:
            # fallback to primary if not found
            with open(p0_path, "rb") as rf, open(p1_path, "wb") as wf:
                wf.write(rf.read())

        # Tertiary photo (2: interior)
        p2_path = os.path.join(PUBLIC_DIR, f"{cid}-2.jpg")
        interior_url = search_commons_image(car["interior"])
        success_2 = download_file(interior_url, p2_path)
        if not success_2 and success_0:
            # fallback to primary if not found
            with open(p0_path, "rb") as rf, open(p2_path, "wb") as wf:
                wf.write(rf.read())

        car_image_data[cid] = {
            "primary": f"/vehicles/{cid}.jpg",
            "gallery": [f"/vehicles/{cid}-0.jpg", f"/vehicles/{cid}-1.jpg", f"/vehicles/{cid}-2.jpg"],
            "remote": [primary_url, rear_url or primary_url, interior_url or primary_url]
        }
        time.sleep(0.3)  # Polite delay to prevent rate limits

    # Write JS helper services/spa/src/vehicleImages.js
    js_content = f"""// Auto-generated vehicle image repository and fallback handler
export const VEHICLE_IMAGES = {json.dumps(car_image_data, indent=2)};

export function getVehicleImages(car) {{
  if (!car) return ['/vehicles/default.jpg', '/vehicles/default.jpg', '/vehicles/default.jpg'];
  const cid = Number(car.id);
  const data = VEHICLE_IMAGES[cid];
  if (data && data.gallery) return data.gallery;
  if (car.images && car.images.length) return car.images;
  if (car.image) return [car.image, car.image, car.image];
  return [`/vehicles/${{cid || 1}}.jpg`, `/vehicles/${{cid || 1}}-1.jpg`, `/vehicles/${{cid || 1}}-2.jpg`];
}}

export function getVehiclePrimaryImage(car) {{
  if (!car) return '/vehicles/default.jpg';
  const cid = Number(car.id);
  const data = VEHICLE_IMAGES[cid];
  if (data && data.primary) return data.primary;
  if (car.image) return car.image;
  return `/vehicles/${{cid || 1}}.jpg`;
}}

export function getVehicleRemoteImages(car) {{
  if (!car) return [];
  const cid = Number(car.id);
  const data = VEHICLE_IMAGES[cid];
  return (data && data.remote) ? data.remote : [];
}}
"""
    js_path = os.path.join(os.path.dirname(__file__), "..", "services", "spa", "src", "vehicleImages.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Generated {js_path}")

    # Copy vehicle 1 as default.jpg
    def_path = os.path.join(PUBLIC_DIR, "default.jpg")
    if os.path.exists(os.path.join(PUBLIC_DIR, "1.jpg")):
        with open(os.path.join(PUBLIC_DIR, "1.jpg"), "rb") as rf, open(def_path, "wb") as wf:
            wf.write(rf.read())

    print("All vehicle images processed successfully!")

if __name__ == "__main__":
    main()
