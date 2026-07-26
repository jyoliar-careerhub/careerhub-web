// G1 게이트 재현용 임시 파일 — 이탈 스타일(임의 값·인라인 스타일)이 check를 실패시키는지 확인한다. 확인 후 제거.
export default function G1Demo() {
  return (
    <div className="p-[13px]" style={{ color: "#ff0000" }}>
      demo
    </div>
  );
}
