import sys
import io
import rawpy
from PIL import Image
import pillow_heif
from pillow_heif import register_heif_opener
register_heif_opener()

def convert_image(input_path, output_path):
    try:
        # 1. HEIC/HEIF 처리
        if pillow_heif.is_supported(input_path):
            img = Image.open(input_path)
            img.convert('RGB').save(output_path, 'JPEG', quality=85)
            print("SUCCESS (HEIC_CONVERTED)")
            return
        # 2. rawpy
        with rawpy.imread(input_path) as raw:
            # 1. 내장 미리보기(Embedded Preview) 추출 시도
            try:
                thumb = raw.extract_thumb()
                if thumb.format == rawpy.ThumbFormat.JPEG:
                    # 썸네일 바이트 데이터를 이미지 객체로 변환
                    img = Image.open(io.BytesIO(thumb.data))
                    
                    # 초소형 썸네일(예: 160x120) 제외: 가로/세로 중 긴 쪽이 800px 이상일 때만 보정본 미리보기로 간주
                    if max(img.size) >= 800:
                        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
                        img.thumbnail((1920, 1920), resample_filter)
                        img.save(output_path, 'JPEG', quality=85)
                        print("SUCCESS (PREVIEW_EXTRACTED)")
                        return
            except (rawpy.LibRawNoThumbnailError, rawpy.LibRawUnsupportedThumbnailError):
                pass
            except Exception:
                pass

            # 2. 내장 미리보기가 없거나 사용할 수 없는 경우 기존 로직(디모자이킹) 적용
            rgb = raw.postprocess(half_size=True, use_camera_wb=True)
            img = Image.fromarray(rgb)
            
            resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
            img.thumbnail((1920, 1920), resample_filter)
            
            img.save(output_path, 'JPEG', quality=85)
            print("SUCCESS (RAW_CONVERTED)")
            
    except Exception as e:
        print(f"PYTHON_ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    convert_image(input_file, output_file)