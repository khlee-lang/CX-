import requests
import json
from datetime import datetime

def check_alimtalk_result(response, today_date):
    res_json = {}
    try:
        res_json = response.json()
    except:
        pass
    
    # 루나소프트는 성공 시 code가 0 (int 또는 string)
    if response.status_code == 200 and (res_json.get('code') == 0 or res_json.get('code') == "0"):
        return True, today_date, res_json
    else:
        return False, "실패", res_json

def receive_payment_request(phone, order_number, fee, depositor):
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50195",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1",
            "msg_content": (
                f"[VERISH] 교환 출고 지연 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환상품 물류사 입고 후 검수작업까지 마친 상태이지만 \n"
                f"교환배송비 미입금으로 출고 지연되고 있어 연락드립니다.\n\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로  입금 부탁드립니다.\n"
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n"
                f"해당 담당자가 입금 확인 후 다음 운영일날 출고 도와드릴수 있도록 하겠습니다.\n"
                f"감사합니다."
            ),
            "sms_content": (
                f"[VERISH] 교환 출고 지연 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환상품 물류사 입고 후 검수작업까지 마친 상태이지만 \n"
                f"교환배송비 미입금으로 출고 지연되고 있어 연락드립니다.\n\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로  입금 부탁드립니다.\n"
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n"
                f"해당 담당자가 입금 확인 후 다음 운영일날 출고 도와드릴수 있도록 하겠습니다.\n"
                f"감사합니다."
            ),
            "template_data": {
                "ORDER_NUMBER": order_number,
                "FEE": fee,
                "DEPOSITOR": depositor
            },
        }]
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)

def receive_options_chioce(phone, order_number):
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50196",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1",
            "msg_content": (
                f"[VERISH] 교환 출고 지연 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환상품 물류사 입고 후 검수작업까지 마친 상태이지만 \n"
                f"교환 옵션 미선택으로 출고 지연되고 있어 연락드립니다.\n\n"
                f"아래 링크로 들어와주셔서 교환은 어떻게 도와드리면 될지 기재 부탁드립니다.\n"
                f"타제품으로는 교환 불가하오니 참고 부탁드립니다."
            ),
            "sms_content": (
                f"[VERISH] 교환 출고 지연 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환상품 물류사 입고 후 검수작업까지 마친 상태이지만 \n"
                f"교환 옵션 미선택으로 출고 지연되고 있어 연락드립니다.\n\n"
                f"아래 링크로 들어와주셔서 교환은 어떻게 도와드리면 될지 기재 부탁드립니다.\n"
                f"타제품으로는 교환 불가하오니 참고 부탁드립니다.\n"            
                f"https://verish.channel.io/workflows/798682"
            ),
            "template_data": {
                "ORDER_NUMBER": order_number
            },
            "btn_url": [{
                "name": "교환 옵션 선택",
                "url_pc" : "https://verish.channel.io/workflows/798682",
                "url_mobile": "https://verish.channel.io/workflows/798682"
            }]
        }]
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)

def receive_payment_options(phone, order_number, fee, depositor):
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    # 원본 스크립트에 oreder_number 오타가 있었으나, 여기서는 safe하게 수정함. 
    # 만약 원본 오타가 템플릿의 변수명이라면 유지해야함. (조사 필요)
    # 원본 확인: "주문번호 {oreder_number}\n" -> f-string 변수명 오타임.
    # 하지만 템플릿 매칭을 위해 원본과 똑같이 유지 (NameError 방지를 위해 local scope에 변수 생성)
    oreder_number = order_number 
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50197",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1",
            "msg_content": (
                f"[VERISH] 교환 출고 지연 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 {oreder_number}\n"
                f"상품 물류사 회수 완료되었지만 교환배송비 미입금과 교환옵션 동일옵션 선택으로 출고 지연되고 있어 연락드립니다.\n\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로  입금 부탁드립니다."
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n"
                f"교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n"
                f"타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n"
                f"반드시 교환하시는 상품만 재포장 해주셔야하는점 안내드립니다."
            ),
            "sms_content": (
                f"[VERISH] 교환 출고 지연 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 {oreder_number}\n"
                f"상품 물류사 회수 완료되었지만 교환배송비 미입금과 교환옵션 동일옵션 선택으로 출고 지연되고 있어 연락드립니다.\n\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로  입금 부탁드립니다."
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n"
                f"교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n"
                f"타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n"
                f"반드시 교환하시는 상품만 재포장 해주셔야하는점 안내드립니다.\n"
                f"https://verish.channel.io/workflows/798682"                
            ),
            "template_data": {
                "ORDER_NUMBER": order_number,
                "FEE": fee,
                "DEPOSITOR": depositor
            },
            "btn_url": [{
                "name": "교환 옵션 선택",
                "url_pc": "https://verish.channel.io/workflows/798682",
                "url_mobile": "https://verish.channel.io/workflows/798682"
            }]
        }]
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)

def noreceive_payment_request(phone, order_number, fee, depositor):
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50198",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1",
            "msg_content": (
                f"[VERISH] 교환배송비 미입금 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환 배송비 미입금으로 다시 연락드립니다.\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로  입금 부탁드립니다.\n"
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n"
                f"혹시나 아직상품이 회수 되지 못하셨다면 아래 버튼을 통해 회수 재접수 요청 부탁드립니다.\n"
                f"회수는 재접수 신청후 영업일 기준 3일 이내 회수기사님 연락과 함께 진행되며\n"
                f"반드시 교환하시는 상품만 재포장 부탁드립니다"
            ),
            "sms_content": (
                f"[VERISH] 교환배송비 미입금 안내\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환 배송비 미입금으로 다시 연락드립니다.\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로  입금 부탁드립니다.\n"
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n"
                f"혹시나 아직상품이 회수 되지 못하셨다면 아래 링크를 통해 회수 재접수 요청 부탁드립니다.\n"
                f"회수는 재접수 신청후 영업일 기준 3일 이내 회수기사님 연락과 함께 진행되며\n"
                f"반드시 교환하시는 상품만 재포장 부탁드립니다\n"
                f"https://verish.channel.io/workflows/100521"
            ),
            "template_data": {
                "ORDER_NUMBER": order_number,
                "FEE": fee,
                "DEPOSITOR": depositor
            },
            "btn_url": [{
                "name": "회수 재접수",
                "url_pc": "https://verish.channel.io/workflows/100521",
                "url_mobile": "https://verish.channel.io/workflows/100521"
            }]
        }]
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)

def noreceive_options_choice(phone, order_number):
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50199",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1", 
            "msg_content": (
                f"[VERISH] 교환 옵션 확인 요청\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n"
                f"교환 옵션 동일 옵션으로 접수 해주셔서 연락드립니다.\n"
                f"교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n"
                f"타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n"
                f"혹여나 상품 회수가 진행되 않으셨다면 아래 회수재접수 버튼을 눌러 회수재접수 신청 부탁드립니다.\n"
                f"회수 재접수 후 회수는 영업일 기준 2일 이내 회수기사님 연락과 함께 진행되며\n"
                f"반드시 교환하시는 상품만 재포장 부탁드립니다."
            ),
            "sms_content": (
                f"[VERISH] 교환 옵션 확인 요청\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n"
                f"교환 옵션 동일 옵션으로 접수 해주셔서 연락드립니다.\n"
                f"교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n"
                f"타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n"
                f"혹여나 상품 회수가 진행되 않으셨다면 아래 회수재접수 버튼을 눌러 회수재접수 신청 부탁드립니다.\n"
                f"회수 재접수 후 회수는 영업일 기준 2일 이내 회수기사님 연락과 함께 진행되며\n"
                f"반드시 교환하시는 상품만 재포장 부탁드립니다.\n\n"
                f"교환 옵션 선택: https://verish.channel.io/workflows/798682\n"
                f"회수재접수: https://verish.channel.io/workflows/100521"                
            ),
            "template_data": {
                "ORDER_NUMBER": order_number
            },
            "btn_url": [{
                "name": "교환 옵션 선택",
                "url_pc": "https://verish.channel.io/workflows/798682",
                "url_mobile": "https://verish.channel.io/workflows/798682"
            },
            {
                "name": "회수 재접수",
                "url_pc": "https://verish.channel.io/workflows/100521",
                "url_mobile": "https://verish.channel.io/workflows/100521"
            }]
        }]
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)

def noreceive_payment_options(phone, order_number, fee, depositor):
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50200",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1",
            "msg_content": (
                f"[VERISH] 교환배송비 미입금 & 동일옵션 선택\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환배송비 미입금과 교환옵션 동일옵션 선택으로 다시 연락드립니다.\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로 입금 부탁드립니다.\n"
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n\n"
                f"교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n"
                f"타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n"
                f"반드시 교환하시는 상품만 재포장 해주셔야하는점 안내드립니다.\n\n"
                f"혹여나 상품 회수가 진행되 않으셨다면 아래 회수재접수 버튼을 눌러 회수재접수 신청 부탁드립니다.\n"
                f"회수 재접수 후 회수는 영업일 기준 2일 이내 회수기사님 연락과 함께 진행되며\n"
                f"반드시 교환하시는 상품만 재포장 부탁드립니다."  
            ),
            "sms_content": (
                f"[VERISH] 교환배송비 미입금 & 동일옵션 선택\n\n"
                f"안녕하세요 고객님, 베리시입니다 :)\n"
                f"주문번호 : {order_number}\n\n\n"
                f"교환배송비 미입금과 교환옵션 동일옵션 선택으로 다시 연락드립니다.\n"
                f"교환 배송비 {fee}원은 아래 계좌로 입금자명 {depositor}으로 입금 부탁드립니다.\n"
                f"입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n\n"
                f"교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n"
                f"타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n"
                f"반드시 교환하시는 상품만 재포장 해주셔야하는점 안내드립니다.\n\n"
                f"혹여나 상품 회수가 진행되 않으셨다면 아래 회수재접수 버튼을 눌러 회수재접수 신청 부탁드립니다.\n"
                f"회수 재접수 후 회수는 영업일 기준 2일 이내 회수기사님 연락과 함께 진행되며\n"
                f"반드시 교환하시는 상품만 재포장 부탁드립니다.\n\n"
                f"교환 옵션 선택: https://verish.channel.io/workflows/798682\n"
                f"회수재접수: https://verish.channel.io/workflows/100521"                 
            ),
            "template_data": {
                "ORDER_NUMBER": order_number,
                "FEE": fee,
                "DEPOSITOR": depositor
            },
            "btn_url": [{
                "name": "교환 옵션 선택",
                "url_pc": "https://verish.channel.io/workflows/798682",
                "url_mobile": "https://verish.channel.io/workflows/798682"
            },
            {
                "name": "회수 재접수",
                "url_pc": "https://verish.channel.io/workflows/100521",
                "url_mobile": "https://verish.channel.io/workflows/100521"
            }]
        }] 
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)

def noreceive_return_request(phone, order_number) :
    url = "https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send"
    header = {"Content-type": "application/json"}
    body = {
        "userid": "verish",
        "api_key": "rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la",
        "template_id": "50201",
        "messages": [{
            "no": "0",
            "tel_num": phone,
            "use_sms": "1",
            "msg_content": (
                f"[VERISH] 회수 내역 확인 요청\n\n"
                f"안녕하세요 고객님, 베리시입니다  :)\n"
                f"주문번호 : {order_number}\n\n"
                f"상품 반송장 조회시 상품 회수 이력 확인되지 않아 연락드립니다.\n"
                f"상품 회수 재접수가 필요하시다면 아래 회수재접수 버튼을 눌러 회수 재접수 부탁드립니다.\n\n"
                f"상품이 이미 회수가 되었다면 회수 송장 공유 버튼을 눌러\n"
                f"기사님이 회수해가시면서 두고가신 영수증에 적힌 반송장 번호 공유 부탁드립니다.\n\n"
                f"회수 내역이 확인 될경우 빠르게 교환 출고가 가능하니 참고 부탁드립니다."

            ),
            "sms_content": (
                f"[VERISH] 회수 내역 확인 요청\n\n"
                f"안녕하세요 고객님, 베리시입니다  :)\n"
                f"주문번호 : {order_number}\n\n"
                f"상품 반송장 조회시 상품 회수 이력 확인되지 않아 연락드립니다.\n"
                f"상품 회수 재접수가 필요하시다면 아래 회수재접수 버튼을 눌러 회수 재접수 부탁드립니다.\n\n"
                f"상품이 이미 회수가 되었다면 회수 송장 공유 버튼을 눌러\n"
                f"기사님이 회수해가시면서 두고가신 영수증에 적힌 반송장 번호 공유 부탁드립니다.\n\n"
                f"회수 내역이 확인 될경우 빠르게 교환 출고가 가능하니 참고 부탁드립니다.\n\n"
                f"회수재접수: https://verish.channel.io/workflows/100521\n"
                f"회수 반송장 공유: https://verish.channel.io/workflows/824557"                
            ),
            "template_data": {
                "ORDER_NUMBER": order_number,
            },
            "btn_url": [{
                "name": "회수 재접수",
                "url_pc": "https://verish.channel.io/workflows/100521",
                "url_mobile": "https://verish.channel.io/workflows/100521"
            },
            {
                "name": "회수 반송장 공유",
                "url_pc": "https://verish.channel.io/workflows/824557",
                "url_mobile": "https://verish.channel.io/workflows/824557"
            }]
        }] 
    }
    res = requests.post(url, headers=header, json=body)
    today_date = datetime.today().strftime('%Y-%m-%d')
    return check_alimtalk_result(res, today_date)
