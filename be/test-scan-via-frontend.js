async function main() {
  const loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gateId: "GATE-1", pin: "123456" })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error("Login failed");

  const scanVerifyReq = await fetch("http://localhost:5001/api/scan/verify", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Gate-Id": loginData.user.gateId,
      "X-Gate-Secret": loginData.user.gateSecret,
    },
    body: JSON.stringify({ qrCode: process.argv[2], eventId: process.argv[3] })
  });
  
  console.log(await scanVerifyReq.json());
}
main().catch(console.error);
