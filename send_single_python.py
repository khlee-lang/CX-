import sys
import json
import alimtalk_core

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No data provided"}))
        return

    try:
        data = json.loads(sys.argv[1])
        row = data.get('row', {})
        
        # 데이터 클리닝 및 변수 설정 (기존 .py 로직과 동일하게)
        phone_raw = row.get('연락처', '').strip()
        import re
        phone = re.sub(r'[^0-9]', '', phone_raw)
        name = row.get('수령자', '').strip()
        address = row.get('주소', '').strip()
        pay_method = row.get('지불방법', '').strip()
        exchange_type = row.get('교환형태', '').strip()
        fee = row.get('택배비', '0').replace(',', '').strip()
        order_number = row.get('주문번호', '').strip()
        
        # 옵션 누락 체크
        missing_option_exists = False
        # 단일 행일 경우 대비
        opt = row.get('교환 출고 옵션', row.get('교환 후 옵션', '')).strip()
        if not opt or opt == '확인중':
            missing_option_exists = True

        is_ipgo = row.get('출고일', '').startswith('입고')
        depositor = f"{name}{phone[-4:]}"
        
        success = False
        result_msg = ""
        template_id = ""

        # 분기 로직 (핵심!)
        if is_ipgo:
            if missing_option_exists:
                if pay_method == "입금요청":
                    success, result_msg, api_response = alimtalk_core.receive_payment_options(phone, order_number, fee, depositor)
                    template_id = "50197"
                else:
                    success, result_msg, api_response = alimtalk_core.receive_options_chioce(phone, order_number)
                    template_id = "50196"
            else:
                if pay_method == "입금요청":
                    success, result_msg, api_response = alimtalk_core.receive_payment_request(phone, order_number, fee, depositor)
                    template_id = "50195"
                else:
                    success, result_msg, api_response = alimtalk_core.noreceive_return_request(phone, order_number)
                    template_id = "50201"
        else:
            # 미입고 상태
            if missing_option_exists:
                if pay_method == "입금요청":
                    success, result_msg, api_response = alimtalk_core.noreceive_payment_options(phone, order_number, fee, depositor)
                    template_id = "50200"
                else:
                    success, result_msg, api_response = alimtalk_core.noreceive_options_choice(phone, order_number)
                    template_id = "50199"
            else:
                if pay_method == "입금요청":
                    success, result_msg, api_response = alimtalk_core.noreceive_payment_request(phone, order_number, fee, depositor)
                    template_id = "50198"
                else:
                    success, result_msg, api_response = alimtalk_core.noreceive_return_request(phone, order_number)
                    template_id = "50201"

        print(json.dumps({
            "success": success,
            "result_msg": result_msg,
            "template_id": template_id,
            "phone": phone,
            "api_response": api_response
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
