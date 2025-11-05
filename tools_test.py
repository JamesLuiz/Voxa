import asyncio
import os

from tools import get_business_context
import json

async def main():
    ctx = None
    biz_id = os.getenv('TEST_BUSINESS_ID', os.getenv('DEFAULT_BUSINESS_ID', ''))
    if not biz_id:
        # fallback to the business id printed by agent startup observed in logs
        biz_id = '69062de90a5bf745215f524f'
    print(f"Testing get_business_context for business id: {biz_id}")
    try:
        res = await get_business_context(ctx, biz_id)
        print('RESULT:')
        try:
            print(json.dumps(json.loads(res), indent=2))
        except Exception:
            print(res)
    except Exception as e:
        print('ERROR calling get_business_context:', e)

if __name__ == '__main__':
    asyncio.run(main())
