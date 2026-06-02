import { expect, test } from "bun:test";
import { checkCheckoutReady } from "../../src/services/fulfillment.js";
import type { OrderFormWithShipping, SavedAddress } from "../../src/services/shipping.js";

const ADDRESS: SavedAddress = {
  addressId: "addr-1",
  addressType: "residential",
  receiverName: "Test User",
  neighborhood: "Rímac",
  street: "Calle 45",
  number: "123",
  city: "Lima",
  postalCode: "15001",
};

test("carrito vacío (items:[]) → ok:false", () => {
  const of: OrderFormWithShipping = { orderFormId: "of-1", items: [] };
  const result = checkCheckoutReady(of);
  expect(result.ok).toBe(false);
  expect(result.reason).toContain("Carrito vacío");
});

test("1 item pero street ausente → ok:false", () => {
  const of: OrderFormWithShipping = {
    orderFormId: "of-1",
    items: [{ id: "sku-1" }],
    shippingData: { address: { ...ADDRESS, street: "" } },
  };
  const result = checkCheckoutReady(of);
  expect(result.ok).toBe(false);
  expect(result.reason).toContain("Dirección sin calle");
});

test("1 item, street ok, pero logisticsInfo:[] → ok:false", () => {
  const of: OrderFormWithShipping = {
    orderFormId: "of-1",
    items: [{ id: "sku-1" }],
    shippingData: { address: ADDRESS, logisticsInfo: [] },
  };
  const result = checkCheckoutReady(of);
  expect(result.ok).toBe(false);
  expect(result.reason).toContain("Logística sin reconciliar");
});

test("1 item, street ok, logisticsInfo cubriendo el item con selectedSla → ok:true", () => {
  const of: OrderFormWithShipping = {
    orderFormId: "of-1",
    items: [{ id: "sku-1" }],
    shippingData: {
      address: ADDRESS,
      logisticsInfo: [
        {
          itemId: "sku-1",
          selectedSla: "Despacho a Domicilio",
          slas: [{ id: "Lima-DD-125", shippingEstimate: "0bd" }],
        },
      ],
    },
  };
  const result = checkCheckoutReady(of);
  expect(result.ok).toBe(true);
  expect(result.reason).toBeUndefined();
});
