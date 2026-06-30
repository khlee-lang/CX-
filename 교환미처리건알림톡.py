import pandas as pd
from datetime import datetime
from dateutil.relativedelta import relativedelta
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import requests
import re

# ✅ 구글 시트 URL 및 연결 함수
SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1cqLifjcihpHlAUN9ZcG19uJ9MhdkYcOxLzMDPcaBufg/edit?pli=1&gid=0#gid=0"
                  
def connect_google_sheet_by_url(spreadsheet_url, worksheet_name="[자사몰] 교환"):
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_name(
        "/Users/deepdive/Documents/강희/GoogleAPI_key/verish-part-68769c380789.json", 
        scope
    )
    client = gspread.authorize(creds)
    return client.open_by_url(spreadsheet_url).worksheet(worksheet_name)

# ✅ 영업일 계산 함수
def get_business_day_after(start_date, days):
    result_date = start_date
    while days > 0:
        result_date += relativedelta(days=1)
        if result_date.weekday() < 5:
            days -= 1
    return result_date.strftime('%Y-%m-%d')

import alimtalk_core

# ✅ 메인 처리 함수
def process_sheet():
    today = datetime.today().strftime('%Y-%m-%d')
    sheet = connect_google_sheet_by_url(SPREADSHEET_URL)
    data = sheet.get_all_values()
    header = data[0]
    df = pd.DataFrame(data[1:], columns=header)

    expect_msg = "교환배송비 입금 후 상품 회수 완료일 제외 영업일 기준 5일 이내"
    updates = []

    # 1. 대상 필터링 (접수일 오늘 + 알림톡 미발송)
    target_df = df[(df['접수일'].str.strip() == today) & (df['알림톡'].str.strip() == '')].copy()
    
    if target_df.empty:
        print("📭 발송할 대상이 없습니다.")
        return

    # 2. 주문번호별로 그룹화하여 처리
    grouped = target_df.groupby('주문번호')

    for order_number, group in grouped:
        indices = group.index.tolist()
        
        first_row = group.iloc[0]
        phone_raw = first_row['연락처'].strip()
        phone = re.sub(r'[^0-9]', '', phone_raw)
        name = first_row['수령자'].strip()
        address = first_row['주소'].strip()
        pay_method = first_row['지불방법'].strip()
        exchange_type = first_row['교환형태'].strip()
        fee = first_row['택배비'].strip()
        shipping_date = "상품 회수 후 영업일 기준 3일 뒤"

        # 3. 우선순위 결정
        missing_option_exists = False
        for _, row in group.iterrows():
            opt = row.get('교환 출고 옵션', row.get('교환 후 옵션', '')).strip()
            if not opt:
                missing_option_exists = True
                break
        
        success = False
        result_msg = ""

        # 전화번호 유효성 체크
        is_phone_valid = bool(re.match(r'^010\d{8}$', phone))
        if not is_phone_valid:
            result_msg = "실패"
        else:
            # 4. 발송 로직 분기
            if missing_option_exists:
                if pay_method in ["무료교환", "입금확인", "차감"]:
                    success, result_msg = same_option(phone, order_number, today)
                elif pay_method == "입금요청":
                    depositor = f"{name}{phone[-4:]}"
                    success, result_msg = same_option_payment_request(phone, order_number, depositor, fee, today)
            else:
                if "제주" in address and pay_method == "입금요청":
                    clean_fee = fee.replace(",", "").strip()
                    if clean_fee == "6000":
                        success, result_msg = send_jeju_notice(phone, name, today)
                    elif clean_fee == "12000":
                        success, result_msg = send_jeju_nofree(phone, name, today)
                elif exchange_type == "선교환":
                    if pay_method == "무료교환":
                        success, result_msg = send_exchange_notice(phone, name, order_number, shipping_date, today)
                    elif pay_method == "입금요청":
                        success, result_msg = send_payment_request_notice(phone, name, order_number, expect_msg, today)
                    elif pay_method == "입금확인":
                        success, result_msg = send_preexchange_deposit_completed(phone, name, order_number, shipping_date, today)

        # 5. 모든 관련 행에 결과 기록 준비
        if result_msg:
            for idx in indices:
                updates.append({
                    "range": f"U{idx+2}",
                    "values": [[result_msg]]
                })

    if updates:
        sheet.batch_update(updates)
        print(f"✅ 총 {len(grouped)}건의 주문에 대해 {len(updates)}개 행 처리 완료")
    else:
        print("📭 처리된 내역이 없습니다.")

if __name__ == "__main__":
    process_sheet()
