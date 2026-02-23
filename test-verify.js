import fetch from 'node-fetch';
async function main() {
  const loginRes = await fetch("http://localhost:5001/api/dashboard/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "408012" })
  });
  const { data: token } = await loginRes.json();
  
  const ordersRes = await fetch("http://localhost:5001/api/orders?limit=1", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const { orders } = await ordersRes.json();
  if (!orders || orders.length === 0) return console.log("No orders");
  
  const order = orders[0];
  console.log("Testing QR Token:", order.qrToken, "Event:", order.eventId);

  const scanRes = await fetch("http://localhost:5001/api/scan/verify", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Gate-Id": "1" // Local test gate
    },
    body: JSON.stringify({ qrCode: order.qrToken, eventId: order.eventId })
  });
  console.log(await scanRes.json());
}
main().catch(console.dir);
