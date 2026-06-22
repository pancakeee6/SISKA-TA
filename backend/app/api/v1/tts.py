import io
import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "id-ID-GadisNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"

@router.post("/synthesize")
async def synthesize_audio(request: TTSRequest):
    try:
        communicate = edge_tts.Communicate(request.text, request.voice, rate=request.rate, pitch=request.pitch)
        
        async def generate_audio():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
                    
        return StreamingResponse(generate_audio(), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
