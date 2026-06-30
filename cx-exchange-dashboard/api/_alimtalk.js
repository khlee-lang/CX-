// Python alimtalk_core.py + send_single_python.py 를 JS로 변환
// 루나소프트 알림톡 API — 템플릿 50195~50201

const LUNASOFT_URL = 'https://jupiter.lunasoft.co.kr/api/AlimTalk/message/send';

function getAuth() {
  return {
    userid: process.env.LUNASOFT_USERID || 'verish',
    api_key: process.env.LUNASOFT_API_KEY || 'rxnqi0z69j5te3d3duhgvxi12dfxio7jdl58a8la',
  };
}

function today() {
  return new Date().toISOString().split('T')[0];
}

async function send(templateId, messages) {
  const res = await fetch(LUNASOFT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...getAuth(), template_id: templateId, messages }),
  });
  const json = await res.json();
  const success = json.code === 0 || json.code === '0';
  return { success, result_msg: success ? today() : '실패', templateId, api_response: json };
}

// 50195 — 입고O / 옵션있음 / 미입금
export function receivePaymentRequest(phone, orderNumber, fee, depositor) {
  const msg = (
    `[VERISH] 교환 출고 지연 안내\n\n` +
    `안녕하세요 고객님, 베리시입니다 :)\n` +
    `주문번호 : ${orderNumber}\n\n\n` +
    `교환상품 물류사 입고 후 검수작업까지 마친 상태이지만 \n` +
    `교환배송비 미입금으로 출고 지연되고 있어 연락드립니다.\n\n` +
    `교환 배송비 ${fee}원은 아래 계좌로 입금자명 ${depositor}으로  입금 부탁드립니다.\n` +
    `입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n` +
    `해당 담당자가 입금 확인 후 다음 운영일날 출고 도와드릴수 있도록 하겠습니다.\n` +
    `감사합니다.`
  );
  return send('50195', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg, sms_content: msg,
    template_data: { ORDER_NUMBER: orderNumber, FEE: fee, DEPOSITOR: depositor },
  }]);
}

// 50196 — 입고O / 옵션없음 / 입금OK
export function receiveOptionsChoice(phone, orderNumber) {
  const msg = (
    `[VERISH] 교환 출고 지연 안내\n\n` +
    `안녕하세요 고객님, 베리시입니다 :)\n` +
    `주문번호 : ${orderNumber}\n\n\n` +
    `교환상품 물류사 입고 후 검수작업까지 마친 상태이지만 \n` +
    `교환 옵션 미선택으로 출고 지연되고 있어 연락드립니다.\n\n` +
    `아래 링크로 들어와주셔서 교환은 어떻게 도와드리면 될지 기재 부탁드립니다.\n` +
    `타제품으로는 교환 불가하오니 참고 부탁드립니다.`
  );
  return send('50196', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg,
    sms_content: msg + '\nhttps://verish.channel.io/workflows/798682',
    template_data: { ORDER_NUMBER: orderNumber },
    btn_url: [{ name: '교환 옵션 선택', url_pc: 'https://verish.channel.io/workflows/798682', url_mobile: 'https://verish.channel.io/workflows/798682' }],
  }]);
}

// 50197 — 입고O / 옵션없음 / 미입금
export function receivePaymentOptions(phone, orderNumber, fee, depositor) {
  const msg = (
    `[VERISH] 교환 출고 지연 안내\n\n` +
    `안녕하세요 고객님, 베리시입니다 :)\n` +
    `주문번호 ${orderNumber}\n` +
    `상품 물류사 회수 완료되었지만 교환배송비 미입금과 교환옵션 동일옵션 선택으로 출고 지연되고 있어 연락드립니다.\n\n` +
    `교환 배송비 ${fee}원은 아래 계좌로 입금자명 ${depositor}으로  입금 부탁드립니다.` +
    `입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n` +
    `교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n` +
    `타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n` +
    `반드시 교환하시는 상품만 재포장 해주셔야하는점 안내드립니다.`
  );
  return send('50197', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg,
    sms_content: msg + '\nhttps://verish.channel.io/workflows/798682',
    template_data: { ORDER_NUMBER: orderNumber, FEE: fee, DEPOSITOR: depositor },
    btn_url: [{ name: '교환 옵션 선택', url_pc: 'https://verish.channel.io/workflows/798682', url_mobile: 'https://verish.channel.io/workflows/798682' }],
  }]);
}

// 50198 — 입고X / 옵션있음 / 미입금
export function noreceivePaymentRequest(phone, orderNumber, fee, depositor) {
  const msg = (
    `[VERISH] 교환배송비 미입금 안내\n\n` +
    `안녕하세요 고객님, 베리시입니다 :)\n` +
    `주문번호 : ${orderNumber}\n\n\n` +
    `교환 배송비 미입금으로 다시 연락드립니다.\n` +
    `교환 배송비 ${fee}원은 아래 계좌로 입금자명 ${depositor}으로  입금 부탁드립니다.\n` +
    `입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n` +
    `혹시나 아직상품이 회수 되지 못하셨다면 아래 버튼을 통해 회수 재접수 요청 부탁드립니다.\n` +
    `회수는 재접수 신청후 영업일 기준 3일 이내 회수기사님 연락과 함께 진행되며\n` +
    `반드시 교환하시는 상품만 재포장 부탁드립니다`
  );
  return send('50198', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg,
    sms_content: msg + '\nhttps://verish.channel.io/workflows/100521',
    template_data: { ORDER_NUMBER: orderNumber, FEE: fee, DEPOSITOR: depositor },
    btn_url: [{ name: '회수 재접수', url_pc: 'https://verish.channel.io/workflows/100521', url_mobile: 'https://verish.channel.io/workflows/100521' }],
  }]);
}

// 50199 — 입고X / 옵션없음 / 입금OK
export function noreceiveOptionsChoice(phone, orderNumber) {
  const msg = (
    `[VERISH] 교환 옵션 확인 요청\n\n` +
    `안녕하세요 고객님, 베리시입니다 :)\n` +
    `주문번호 : ${orderNumber}\n\n` +
    `교환 옵션 동일 옵션으로 접수 해주셔서 연락드립니다.\n` +
    `교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n` +
    `타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n` +
    `혹여나 상품 회수가 진행되 않으셨다면 아래 회수재접수 버튼을 눌러 회수재접수 신청 부탁드립니다.\n` +
    `회수 재접수 후 회수는 영업일 기준 2일 이내 회수기사님 연락과 함께 진행되며\n` +
    `반드시 교환하시는 상품만 재포장 부탁드립니다.`
  );
  return send('50199', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg,
    sms_content: msg + '\n\n교환 옵션 선택: https://verish.channel.io/workflows/798682\n회수재접수: https://verish.channel.io/workflows/100521',
    template_data: { ORDER_NUMBER: orderNumber },
    btn_url: [
      { name: '교환 옵션 선택', url_pc: 'https://verish.channel.io/workflows/798682', url_mobile: 'https://verish.channel.io/workflows/798682' },
      { name: '회수 재접수', url_pc: 'https://verish.channel.io/workflows/100521', url_mobile: 'https://verish.channel.io/workflows/100521' },
    ],
  }]);
}

// 50200 — 입고X / 옵션없음 / 미입금
export function noreceivePaymentOptions(phone, orderNumber, fee, depositor) {
  const msg = (
    `[VERISH] 교환배송비 미입금 & 동일옵션 선택\n\n` +
    `안녕하세요 고객님, 베리시입니다 :)\n` +
    `주문번호 : ${orderNumber}\n\n\n` +
    `교환배송비 미입금과 교환옵션 동일옵션 선택으로 다시 연락드립니다.\n` +
    `교환 배송비 ${fee}원은 아래 계좌로 입금자명 ${depositor}으로 입금 부탁드립니다.\n` +
    `입금정보: 814301-04-286431 국민은행 (주)딥다이브\n\n\n` +
    `교환 옵션은 아래 링크로 들어와주셔서 교환 옵션 기재 부탁드리며\n` +
    `타제품으로 교환 불가한 점 참고 부탁드립니다.\n\n` +
    `반드시 교환하시는 상품만 재포장 해주셔야하는점 안내드립니다.\n\n` +
    `혹여나 상품 회수가 진행되 않으셨다면 아래 회수재접수 버튼을 눌러 회수재접수 신청 부탁드립니다.\n` +
    `회수 재접수 후 회수는 영업일 기준 2일 이내 회수기사님 연락과 함께 진행되며\n` +
    `반드시 교환하시는 상품만 재포장 부탁드립니다.`
  );
  return send('50200', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg,
    sms_content: msg + '\n\n교환 옵션 선택: https://verish.channel.io/workflows/798682\n회수재접수: https://verish.channel.io/workflows/100521',
    template_data: { ORDER_NUMBER: orderNumber, FEE: fee, DEPOSITOR: depositor },
    btn_url: [
      { name: '교환 옵션 선택', url_pc: 'https://verish.channel.io/workflows/798682', url_mobile: 'https://verish.channel.io/workflows/798682' },
      { name: '회수 재접수', url_pc: 'https://verish.channel.io/workflows/100521', url_mobile: 'https://verish.channel.io/workflows/100521' },
    ],
  }]);
}

// 50201 — 입고X / 옵션있음 / 입금OK (회수 미확인)
export function noreceiveReturnRequest(phone, orderNumber) {
  const msg = (
    `[VERISH] 회수 내역 확인 요청\n\n` +
    `안녕하세요 고객님, 베리시입니다  :)\n` +
    `주문번호 : ${orderNumber}\n\n` +
    `상품 반송장 조회시 상품 회수 이력 확인되지 않아 연락드립니다.\n` +
    `상품 회수 재접수가 필요하시다면 아래 회수재접수 버튼을 눌러 회수 재접수 부탁드립니다.\n\n` +
    `상품이 이미 회수가 되었다면 회수 송장 공유 버튼을 눌러\n` +
    `기사님이 회수해가시면서 두고가신 영수증에 적힌 반송장 번호 공유 부탁드립니다.\n\n` +
    `회수 내역이 확인 될경우 빠르게 교환 출고가 가능하니 참고 부탁드립니다.`
  );
  return send('50201', [{
    no: '0', tel_num: phone, use_sms: '1',
    msg_content: msg,
    sms_content: msg + '\n\n회수재접수: https://verish.channel.io/workflows/100521\n회수 반송장 공유: https://verish.channel.io/workflows/824557',
    template_data: { ORDER_NUMBER: orderNumber },
    btn_url: [
      { name: '회수 재접수', url_pc: 'https://verish.channel.io/workflows/100521', url_mobile: 'https://verish.channel.io/workflows/100521' },
      { name: '회수 반송장 공유', url_pc: 'https://verish.channel.io/workflows/824557', url_mobile: 'https://verish.channel.io/workflows/824557' },
    ],
  }]);
}

// ── 분기 로직 (send_single_python.py 이식) ──────────────────────
export async function dispatchAlimtalk(row) {
  const phone = (row['연락처'] || '').replace(/[^0-9]/g, '');
  const orderNumber = (row['주문번호'] || '').trim();
  const name = (row['수령자'] || '').trim();
  const payMethod = (row['지불방법'] || '').trim();
  const fee = (row['택배비'] || '0').replace(/,/g, '').trim();
  const shipVal = (row['출고일'] || '').trim();
  const opt = (row['교환 출고 옵션'] || row['교환 후 옵션'] || '').trim();

  if (!/^010\d{8}$/.test(phone)) {
    return { success: false, error: '유효하지 않은 전화번호' };
  }

  const isArrived = shipVal.startsWith('입고');
  const missingOption = !opt || opt === '확인중';
  const depositor = `${name}${phone.slice(-4)}`;

  if (isArrived) {
    if (missingOption) {
      return payMethod === '입금요청'
        ? receivePaymentOptions(phone, orderNumber, fee, depositor)
        : receiveOptionsChoice(phone, orderNumber);
    } else {
      return payMethod === '입금요청'
        ? receivePaymentRequest(phone, orderNumber, fee, depositor)
        : noreceiveReturnRequest(phone, orderNumber);
    }
  } else {
    if (missingOption) {
      return payMethod === '입금요청'
        ? noreceivePaymentOptions(phone, orderNumber, fee, depositor)
        : noreceiveOptionsChoice(phone, orderNumber);
    } else {
      return payMethod === '입금요청'
        ? noreceivePaymentRequest(phone, orderNumber, fee, depositor)
        : noreceiveReturnRequest(phone, orderNumber);
    }
  }
}
