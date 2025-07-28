/* eslint-disable @typescript-eslint/no-explicit-any */

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { listenPrinter } from './services/printer';

// Declare o plugin background-mode globalmente
declare global {
  interface Window {
    cordova: any;
    plugins: {
      backgroundMode: {
        enable: () => void;
        disable: () => void;
        setDefaults: (options: any) => void;
        configure: (options: any) => void;
        on: (event: string, callback: () => void) => void;
        isActive: () => boolean;
      };
    };
  }
}

export interface PrinterServiceConfig {
  dealerId?: string;
  printerDeviceId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export class PrinterBackgroundService {
  private static instance: PrinterBackgroundService;
  private isRunning = false;
  private config: PrinterServiceConfig = {};
  private reconnectTimer: any;
  private backgroundMode: any;

  private constructor() {
    this.initializeBackgroundMode();
  }

  static getInstance(): PrinterBackgroundService {
    if (!PrinterBackgroundService.instance) {
      PrinterBackgroundService.instance = new PrinterBackgroundService();
    }
    return PrinterBackgroundService.instance;
  }

  private async initializeBackgroundMode() {
    if (Capacitor.isNativePlatform()) {
      // Aguardar o dispositivo estar pronto
      await Device.getInfo();
      
      // Acessar o plugin background-mode via cordova
      if (window.cordova && window.plugins && window.plugins.backgroundMode) {
        this.backgroundMode = window.plugins.backgroundMode;
      }
    }
  }

  async startService(config: PrinterServiceConfig = {}) {
    try {
      this.config = {
        autoReconnect: true,
        reconnectInterval: 30000, // 30 segundos
        ...config
      };

      // Verificar se está em dispositivo móvel
      if (!Capacitor.isNativePlatform()) {
        console.warn('Background mode só funciona em dispositivos móveis');
        await this.startPrinterService();
        return;
      }

      // Configurar o background mode
      await this.configureBackgroundMode();

      // Habilitar background mode
      if (this.backgroundMode) {
        this.backgroundMode.enable();
      }

      // Iniciar o serviço de impressão
      await this.startPrinterService();

      // Configurar auto-reconexão se habilitada
      if (this.config.autoReconnect) {
        this.setupAutoReconnect();
      }

      this.isRunning = true;
      console.log('Serviço de impressão iniciado em background');

    } catch (error) {
      console.error('Erro ao iniciar serviço:', error);
      throw error;
    }
  }

  async stopService() {
    try {
      this.isRunning = false;

      // Parar auto-reconexão
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Parar o serviço de impressão
      await listenPrinter(true);

      // Desabilitar background mode se estiver em dispositivo móvel
      if (Capacitor.isNativePlatform() && this.backgroundMode) {
        this.backgroundMode.disable();
      }

      console.log('Serviço de impressão parado');

    } catch (error) {
      console.error('Erro ao parar serviço:', error);
    }
  }

  private async configureBackgroundMode() {
    if (!this.backgroundMode) {
      console.warn('Background mode plugin não disponível');
      return;
    }

    // Configurar as opções do background mode
    this.backgroundMode.setDefaults({
      title: 'Serviço de Impressão',
      text: 'Monitorando novos pedidos para impressão',
      icon: 'icon', // ícone da notificação
      color: '000000', // cor da notificação
      resume: true,
      hidden: false,
      bigText: false,
      silent: false
    });

    // Configurar eventos do background mode
    this.backgroundMode.on('activate', () => {
      console.log('Background mode ativado');
      this.onBackgroundActivated();
    });

    this.backgroundMode.on('deactivate', () => {
      console.log('Background mode desativado');
    });

    this.backgroundMode.on('failure', (error: any) => {
      console.error('Erro no background mode:', error);
    });
  }

  private async onBackgroundActivated() {
    try {
      // Verificar se o serviço ainda está rodando
      if (!this.isRunning) {
        return;
      }

      // Manter o serviço ativo em background
      console.log('Aplicativo em background - mantendo serviço ativo');

      // Atualizar a notificação
      if (this.backgroundMode) {
        this.backgroundMode.configure({
          text: `Serviço ativo - ${new Date().toLocaleTimeString()}`
        });
      }

    } catch (error) {
      console.error('Erro ao ativar background:', error);
    }
  }

  private async startPrinterService() {
    try {
      // Iniciar o listener de impressão
      await listenPrinter(false);
      console.log('Serviço de impressão conectado');

    } catch (error) {
      console.error('Erro ao iniciar serviço de impressão:', error);
      
      // Tentar reconectar se auto-reconexão estiver habilitada
      if (this.config.autoReconnect && this.isRunning) {
        console.log('Tentando reconectar em 10 segundos...');
        setTimeout(() => {
          if (this.isRunning) {
            this.startPrinterService();
          }
        }, 10000);
      }
      
      throw error;
    }
  }

  private setupAutoReconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        console.log('Verificando conexão do serviço...');
        
        // Atualizar notificação com status
        if (Capacitor.isNativePlatform() && this.backgroundMode) {
          this.backgroundMode.configure({
            text: `Ativo - Última verificação: ${new Date().toLocaleTimeString()}`
          });
        }

      } catch (error) {
        console.error('Erro na verificação de reconexão:', error);
        
        // Tentar reconectar
        try {
          await this.startPrinterService();
        } catch (reconnectError) {
          console.error('Erro ao reconectar:', reconnectError);
        }
      }
    }, this.config.reconnectInterval || 30000);
  }

  // Métodos utilitários
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  getServiceConfig(): PrinterServiceConfig {
    return { ...this.config };
  }

  async forceReconnect() {
    if (this.isRunning) {
      console.log('Forçando reconexão...');
      await this.startPrinterService();
    }
  }
}