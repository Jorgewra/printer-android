import io from "socket.io-client";
import { Preferences } from "@capacitor/preferences";
import { BleClient } from "@capacitor-community/bluetooth-le";

const url = "https://api.adm2u.com";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let socket: any;
export const listenPrinter = async (isDisconnect: boolean = false) => {
  try {
    const { value: account_str } = await Preferences.get({
      key: "zacksys_printer_account",
    });
    const { value: printer_str } = await Preferences.get({
      key: "zacksys_printer",
    });
    if (!account_str || !printer_str) {
      alert("Selecione a impressora!");
      return;
    }

    const account = JSON.parse(account_str);
    const printer = JSON.parse(printer_str);
    if (isDisconnect) {
      if (socket) socket.disconnect();
      // Desconectar
      try {
        if (printer) {
          await BleClient.disconnect(printer.idPrint);
        }
      } catch (e) {
        console.log("Erro ao desconectar:", e);
      }
      return;
    }


    socket = io(url, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socket.on("connect", () => {
      if (socket.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const dealer of account.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          socket.on("new-" + dealer?.dealers?.id, async (order: any) => {
            try {
              const dealer = account.data.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (el: any) => el.dealers.id == order.data.dealerId
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const listItems = order.data.orderitens
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((el: any) => {
                  const name = el.productdealers.name
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase();
                  const price = Number(el.price * el.quantity)
                    .toFixed(2)
                    .replace(".", ",");
                  return `${name.padEnd(30)} ${String(el.quantity).padStart(
                    3
                  )} x R$ ${price.padStart(8)}\n`;
                })
                .join("");

              const rawCommands = [
                // Initialize printer
                new Uint8Array([0x1d, 0x21, 0x01]),
                // Center align
                new Uint8Array([0x1b, 0x61, 0x01]),
                new Uint8Array([0x1d, 0x21, 0x01]),
                // Header info
                new Uint8Array([
                  ...new TextEncoder().encode(
                    `${dealer?.dealers?.name
                      ?.normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")}\n`
                  ),
                ]),
                new Uint8Array([
                  ...new TextEncoder().encode(`${dealer?.dealers?.phone}\n`),
                ]),
                new Uint8Array([
                  ...new TextEncoder().encode(
                    `${dealer?.dealers?.street
                      ?.normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")}\n\n`
                  ),
                ]),
                new Uint8Array([
                  ...new TextEncoder().encode(
                    "Data: " + new Date().toLocaleDateString() + "\n"
                  ),
                ]),
                new Uint8Array([
                  ...new TextEncoder().encode(`Pedido N:${order.data.id}\n`),
                ]),

                // Left align
                new Uint8Array([0x1b, 0x61, 0x00]),
                new Uint8Array([
                  ...new TextEncoder().encode(
                    `${
                      order.data.identityLocal
                        ? order.data.identityLocal
                            ?.normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                        : (
                            order.data.street
                              ?.normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .toUpperCase() +
                            "," +
                            order.data.num_home +
                            " " +
                            order.data.referenceAddress
                              ?.normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .toUpperCase() +
                            " " +
                            order.data.district
                              ?.normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                          ).toUpperCase()
                    }\n`
                  ),
                ]),

                // Items header
                new Uint8Array([
                  ...new TextEncoder().encode("Item:\n".toUpperCase()),
                ]),
                new Uint8Array([...new TextEncoder().encode(listItems)]),
                new Uint8Array([
                  ...new TextEncoder().encode(
                    `${
                      order.data.rate
                        ? "Taxa: R$ " +
                          Number(order.data.rate)
                            .toFixed(2)
                            .replace(".", ",")
                            .padStart(8) +
                          "\n"
                        : ""
                    }`
                  ),
                ]),

                // Footer
                new Uint8Array([0x1b, 0x61, 0x01]), // Center align
                // Total amount
                new Uint8Array([
                  ...new TextEncoder().encode(
                    "Total: R$ " +
                      Number(order.data.total)
                        .toFixed(2)
                        .replace(".", ",")
                        .padStart(8) +
                      "\n"
                  ),
                ]),

                new Uint8Array([0x1b, 0x45, 0x01]), // Bold on
                new Uint8Array([
                  ...new TextEncoder().encode("OBRIGADO PELA PREFERENCIA!\n"),
                ]),
                new Uint8Array([0x1b, 0x45, 0x00]), // Bold off

                // Line feeds and cut
                new Uint8Array([...new TextEncoder().encode("\n\n\n")]),
                new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // Cut paper
              ];

              // Enviar comandos RAW
              for (const command of rawCommands) {
                await BleClient.write(
                  printer.idPrint,
                  printer.serviceUuid,
                  printer.characteristicUuid,
                  new DataView(command.buffer)
                );
                //await new Promise((resolve) => setTimeout(resolve, 50));
              }
            } catch (error) {
              console.log("Errofromatação" + error);             
              console.log("printer" + JSON.stringify(printer));
              alert("erro de impressão");
            }
          });
        }
      } else {
        console.log("no-socket");
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("disconnect", (reason: any) => {
      console.log("WebSocket desconectado:", reason);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("connect_error", (error: any) => {
      console.error("Erro de conexão WebSocket:", error);
      alert("Erro de conexão WebSocket:" + error);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Erro ao imprimir:", error?.message);
  }
};
