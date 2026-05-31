import { expect, test } from "bun:test";
import { parseSimulateResult } from "../../src/services/cart.js";

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

const SKU = "999001";

test("available:true cuando logisticsInfo tiene el SKU con SLA", () => {
  const logistics = [
    {
      itemId: SKU,
      slas: [
        { id: "Lima-Rimac-DD-125", shippingEstimate: "0bd", polygonName: "Lima-Rimac" },
      ],
    },
  ];
  const result = parseSimulateResult(SKU, logistics, MOCK_ADDRESS);
  expect(result.available).toBe(true);
  expect(result.slaName).toBe("Lima-Rimac-DD-125");
  expect(result.shippingEstimate).toBe("0bd");
  expect(result.polygon).toBe("Lima-Rimac");
  expect(result.address).toBe(MOCK_ADDRESS);
});

test("available:false cuando SKU no aparece en logisticsInfo", () => {
  const logistics = [
    { itemId: "otro-sku", slas: [{ id: "SLA-X", shippingEstimate: "1bd" }] },
  ];
  const result = parseSimulateResult(SKU, logistics, MOCK_ADDRESS);
  expect(result.available).toBe(false);
  expect(result.slaName).toBeNull();
  expect(result.shippingEstimate).toBeNull();
});

test("available:false cuando SKU tiene slas vacío (sin stock local)", () => {
  const logistics = [{ itemId: SKU, slas: [] }];
  const result = parseSimulateResult(SKU, logistics, MOCK_ADDRESS);
  expect(result.available).toBe(false);
  expect(result.slaName).toBeNull();
  expect(result.address).toBe(MOCK_ADDRESS);
});
