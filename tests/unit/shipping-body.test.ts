import { expect, test } from "bun:test";
import { buildShippingBody } from "../../src/services/shipping.js";

const MOCK_ADDRESS = {
  addressId: "addr-1",
  addressType: "residential",
  receiverName: "Test User",
  neighborhood: "Rímac",
  street: "Av. Test",
  number: "123",
  city: "Lima",
  postalCode: "15001",
};

test("itemCount 0 → body solo { address }, sin logisticsInfo", () => {
  const body = buildShippingBody(MOCK_ADDRESS, 0);
  expect(body.address).toBe(MOCK_ADDRESS);
  expect("logisticsInfo" in body).toBe(false);
});

test("itemCount 2 → body con logisticsInfo de length 2 e itemIndex 0 y 1", () => {
  const body = buildShippingBody(MOCK_ADDRESS, 2);
  expect(body.address).toBe(MOCK_ADDRESS);
  expect("logisticsInfo" in body).toBe(true);
  const li = (body as { logisticsInfo: Array<Record<string, unknown>> }).logisticsInfo;
  expect(li).toHaveLength(2);
  expect(li[0]?.itemIndex).toBe(0);
  expect(li[1]?.itemIndex).toBe(1);
  for (const entry of li) {
    expect(entry.selectedSla).toBe("Despacho a Domicilio");
    expect(entry.selectedDeliveryChannel).toBe("delivery");
  }
});
