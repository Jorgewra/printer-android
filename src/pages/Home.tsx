import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonInputPasswordToggle,
} from "@ionic/react";
import { useEffect, useState } from "react";
import "./Home.css";
import { BleClient, BleService } from "@capacitor-community/bluetooth-le";

import axios from "axios";
import { Preferences } from "@capacitor/preferences";
//import { listenPrinter } from "../services/printer";
import { PrinterBackgroundService } from "../PrinterBackgroundService";
const url = "https://api.adm2u.com";

const Home: React.FC = () => {
  const [isConnect, setIsConnect] = useState(false);
  const [idPrint, setIdPrint] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [printerName, setPrinterName] = useState("Escanear Impressoras");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [account, setAccount] = useState<any>();
   const printerService = PrinterBackgroundService.getInstance();

  useEffect(() => {
    getAccount();
    initializeBluetooth();
  }, []);
  useEffect(() => {
    if (account) {
    //  service.startService();
    startBackgroundService()
    }
  }, [account]);
  const startBackgroundService = async () => {
    try {
      await printerService.startService({
        dealerId: 'seu-dealer-id',
        autoReconnect: true,
        reconnectInterval: 30000
      });
      console.log('Serviço iniciado com sucesso');
    } catch (error) {
      console.error('Erro ao iniciar serviço:', error);
    }
  };

  const stopBackgroundService = async () => {
    try {
      await printerService.stopService();
      console.log('Serviço parado com sucesso');
    } catch (error) {
      console.error('Erro ao parar serviço:', error);
    }
  };
  const getAccount = async () => {
    const { value } = await Preferences.get({ key: "zacksys_printer_auth" });
    if (value) {
      const account = JSON.parse(value);
      setUser(account?.user);
      setPassword(account?.password);
    }
  };

  const initializeBluetooth = async () => {
    try {
      // Inicializar primeiro
      await BleClient.initialize({ androidNeverForLocation: true });
      setIsInitialized(true);
      // Verificar se Bluetooth está habilitado
      if (!(await BleClient.isEnabled())) {
        await BleClient.enable();
      }
    } catch (error) {
      setIsInitialized(false);
      console.error("Erro ao inicializar Bluetooth LE:", error);
    }
  };

  const scanForPrinters = async () => {
    try {
      if (!isInitialized) {
        await initializeBluetooth();
      }
      // Escanear dispositivos Bluetooth LE
      const device = await BleClient.requestDevice({
        allowDuplicates: false,
        optionalServices: [],
      });

      if (device) {
        setPrinterName((device.name || device.deviceId) + " Pronta!");
        setIdPrint(device.deviceId);
      }
    } catch (error) {
      console.error("Erro ao escanear:", error);
      setIdPrint("");
    }
  };

  const connectAndGetServices = async (deviceId: string) => {
    try {
      await BleClient.connect(deviceId);
      // Obter serviços do dispositivo
      const services: BleService[] = await BleClient.getServices(deviceId);
      let printService = "";
      let printCharacteristic = "";

      // Primeiro, tentar encontrar serviços conhecidos
      for (const service of services) {
        for (const charact of service.characteristics) {
          if (
            charact.properties.writeWithoutResponse &&
            charact.properties.write
          ) {
            printService = service.uuid;
            printCharacteristic = charact.uuid;
          }
          if (
            charact.properties.writeWithoutResponse &&
            charact.properties.write &&
            charact.properties.notify
          ) {
            printService = service.uuid;
            printCharacteristic = charact.uuid;
          }
        }
      }

      return {
        status: true,
        serviceUuid: printService,
        characteristicUuid: printCharacteristic,
        idPrint: deviceId,
      };
    } catch (error) {
      console.error("Erro ao conectar:", error);
      return {
        status: false,
        serviceUuid: "",
        characteristicUuid: "",
        idPrint: "",
      };
    }
  };

  const auth = async () => {
    try {
      if (isConnect) {
        await stopBackgroundService();
        setIsConnect(false);
        return;
      }
      if (!idPrint) {
        alert("Selecione a impressora!");
        return;
      }
      if (!user || !password) {
        alert("Preencha o usuário e senha!");
        return;
      }
      setIsConnect(true);
      // Conectar e obter serviços
      const connected = await connectAndGetServices(idPrint);
      if (!connected || !connected?.status) {
        alert("Erro ao conectar com a impressora");
        return;
      }
      const credenciaisBase64 = btoa(`${user}:${password}`);
      // Configurar cabeçalhos com autenticação
      const config = {
        headers: {
          Authorization: `Basic ${credenciaisBase64}`,
          "Content-Type": "application/json",
        },
      };
      const response = await axios.get(`${url}/api/integration/auth`, config);
      if (response.status == 200) {
        await Preferences.set({
          key: "zacksys_printer_account",
          value: JSON.stringify(response.data),
        });
        await Preferences.set({
          key: "zacksys_printer_auth",
          value: JSON.stringify({
            user: user,
            password: password,
          }),
        });
        await Preferences.set({
          key: "zacksys_printer",
          value: JSON.stringify(connected),
        });
        setAccount(response.data);
      } else {
        setIsConnect(false);
        alert("Erro de Autenticação ");
      }
    } catch (error) {
      setIsConnect(false);
      console.error("Erro ao imprimir:", error);
      alert("Erro de Autenticação: " + error);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ textAlign: "center" }} color={"primary"}>
            Xeggo Printers Connect
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ padding: "20px", marginBottom: "20px" }}>
          <div
            style={{
              background: "#f5f5f5",
              borderRadius: "8px",
              padding: "15px",
              marginBottom: "0px",
            }}
          >
            <h2
              style={{
                margin: "0 0 10px 0",
                fontSize: "1.2em",
                color: "#333",
              }}
            >
              Fila de Impressão
            </h2>
            <p>Solicitações de impressão recebidas</p>
            <p>
              Todos os trabalhos de impressão serão processados automaticamente
              após a conexão com uma impressora
            </p>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              width: "100%",
              maxWidth: "400px",
            }}
          >
            <IonItem>
              <IonLabel position="floating">Usuario</IonLabel>
              <IonInput
                type="text"
                className="custom-input"
                value={user}
                onIonChange={(e) => setUser(e.detail.value!)}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Senha</IonLabel>
              <IonInput
                type={"password"}
                className="custom-input"
                value={password}
              >
                 <IonInputPasswordToggle slot="end"></IonInputPasswordToggle>
              </IonInput>
              

            </IonItem>

            <IonButton
              expand="block"
              fill="outline"
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
              }}
              onClick={scanForPrinters}
            >
              {printerName}
            </IonButton>
            <IonButton
              expand="block"
              style={{
                marginTop: "20px",
              }}
              onClick={auth}
            >
              {isConnect
                ? "Click e Cancela"
                : "Conectar e Imprimir"}
            </IonButton>
            {isConnect && ("Aguardando Impressões....")}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
