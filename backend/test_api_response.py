"""Quick test to see the raw AI API response format for face recognition."""
import httpx
import asyncio
import json
import sys

async def test_recognize():
    # Buat gambar tes dari webcam (ambil dari file jika ada)
    # Atau gunakan file test jika tersedia
    import os
    
    test_image = None
    
    # Coba cari gambar tes
    for path in ["test_face.jpg", "test.jpg"]:
        if os.path.exists(path):
            test_image = path
            break
    
    if not test_image:
        # Buat gambar hitam kecil sebagai dummy
        print("Tidak ada gambar tes. Mengirim gambar dummy untuk melihat format response...")
        # Buat PNG 1x1 pixel
        import struct
        import zlib
        
        def create_png():
            signature = b'\x89PNG\r\n\x1a\n'
            ihdr_data = struct.pack('>IIBBBBB', 100, 100, 8, 2, 0, 0, 0)
            ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
            ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
            
            raw_data = b''
            for y in range(100):
                raw_data += b'\x00' + b'\x80\x80\x80' * 100
            
            compressed = zlib.compress(raw_data)
            idat_crc = zlib.crc32(b'IDAT' + compressed)
            idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
            
            iend_crc = zlib.crc32(b'IEND')
            iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
            
            return signature + ihdr + idat + iend
        
        png_data = create_png()
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://elsann-api-absensi.hf.space/v1/recognize_multi",
                files={"file": ("test.png", png_data, "image/png")},
                headers={
                    "x-device-id": "stb-01",
                    "x-device-token": "87654321",
                },
            )
            print(f"Status: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
    else:
        with open(test_image, "rb") as f:
            content = f.read()
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://elsann-api-absensi.hf.space/v1/recognize_multi",
                files={"file": (test_image, content, "image/jpeg")},
                headers={
                    "x-device-id": "stb-01",
                    "x-device-token": "87654321",
                },
            )
            print(f"Status: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2)}")

asyncio.run(test_recognize())
