import type { AppLanguage } from '../shared/models/AppSettings'

export type MessageKey =
  | 'welcome.title'
  | 'welcome.text'
  | 'welcome.start'
  | 'language.title'
  | 'language.text'
  | 'language.english'
  | 'language.spanish'
  | 'language.continue'
  | 'regfox.title'
  | 'regfox.text'
  | 'regfox.apiKey'
  | 'regfox.pageId'
  | 'regfox.connect'
  | 'regfox.connected'
  | 'regfox.back'
  | 'regfox.retry'
  | 'printer.title'
  | 'printer.text'
  | 'printer.select'
  | 'printer.test'
  | 'printer.skip'
  | 'printer.continue'
  | 'printer.back'
  | 'mobile.title'
  | 'mobile.text'
  | 'mobile.ready'
  | 'mobile.setupTitle'
  | 'mobile.serviceUrl'
  | 'mobile.publicKey'
  | 'mobile.desktopKey'
  | 'mobile.conferenceId'
  | 'mobile.appUrl'
  | 'mobile.appUrlHelp'
  | 'mobile.scannerUrl'
  | 'mobile.testContinue'
  | 'mobile.technicalHelp'
  | 'mobile.technicalText'
  | 'mobile.back'
  | 'mobile.retry'
  | 'ready.title'
  | 'ready.text'
  | 'ready.attendees'
  | 'ready.printerReady'
  | 'ready.printerUnavailable'
  | 'ready.mobileReady'
  | 'ready.mobileNeeded'
  | 'ready.finish'
  | 'home.conference'
  | 'home.status.registration'
  | 'home.status.printerReady'
  | 'home.status.printerUnavailable'
  | 'home.status.mobileReady'
  | 'home.status.mobileNeeded'
  | 'home.status.lastUpdate'
  | 'home.action.find'
  | 'home.action.print'
  | 'home.action.validate'
  | 'home.action.connectPhone'
  | 'home.action.mealDashboard'
  | 'home.action.eventSettings'
  | 'home.action.update'
  | 'home.updating'
  | 'connect.title'
  | 'connect.loading'
  | 'connect.setupNeeded'
  | 'connect.setupButton'
  | 'connect.serviceUnavailable'
  | 'connect.noPhoneUrl'
  | 'connect.configureWebAddress'
  | 'connect.startTestServer'
  | 'connect.testServerHint'
  | 'connect.localTesting'
  | 'connect.step1'
  | 'connect.step2'
  | 'connect.step3'
  | 'connect.step4'
  | 'connect.scannerCode'
  | 'connect.mobileUrl'
  | 'connect.copy'
  | 'connect.copyCode'
  | 'connect.copied'
  | 'connect.copiedCode'
  | 'connect.qrError'
  | 'mobile.simpleText'
  | 'mobile.skipForNow'
  | 'ready.mobileLater'
  | 'home.status.attendees'
  | 'home.action.refresh'
  | 'connect.instruction'
  | 'connect.waiting'
  | 'connect.renewing'
  | 'connect.expiresIn'
  | 'connect.expired'
  | 'connect.newCode'
  | 'connect.phoneConnected'
  | 'connect.unavailable'
  | 'settings.showDesktopMealValidation'
  | 'settings.scannerWebAddress'
  | 'settings.phoneServiceTitle'
  | 'settings.cloudOverrideHelp'
  | 'settings.cloudEnrollTitle'
  | 'settings.cloudEnrollHelp'
  | 'settings.cloudEnrollmentCode'
  | 'settings.cloudEnrollButton'
  | 'settings.cloudEnrolled'
  | 'settings.saveAdvanced'
  | 'sync.title'
  | 'sync.text'
  | 'sync.enterCodeHelp'
  | 'sync.codeLabel'
  | 'sync.codePlaceholder'
  | 'sync.connect'
  | 'sync.reconnect'
  | 'sync.checking'
  | 'sync.connecting'
  | 'sync.connected'
  | 'sync.connectedCheck'
  | 'sync.setupLater'
  | 'sync.error.invalidCode'
  | 'sync.error.expiredCode'
  | 'sync.error.revoked'
  | 'sync.error.needsReconnect'
  | 'sync.error.unavailable'
  | 'home.status.syncConnected'
  | 'home.status.syncNeeded'
  | 'home.status.syncReconnect'
  | 'home.action.foxbridgeSync'
  | 'ready.syncReady'
  | 'ready.syncLater'
  | 'connect.close'
  | 'settings.title'
  | 'settings.reopenSetup'
  | 'settings.advanced'
  | 'settings.language'
  | 'common.back'
  | 'common.next'

const en: Record<MessageKey, string> = {
  'welcome.title': 'Welcome to FoxBridge',
  'welcome.text': "Let's get your conference ready.",
  'welcome.start': 'Start setup',
  'language.title': 'Choose a language',
  'language.text': 'Pick the language volunteers will see in setup and on the home screen.',
  'language.english': 'English',
  'language.spanish': 'Español',
  'language.continue': 'Continue',
  'regfox.title': 'Connect registration',
  'regfox.text': 'Enter your RegFox credentials. FoxBridge will connect and download attendees automatically.',
  'regfox.apiKey': 'RegFox API key',
  'regfox.pageId': 'RegFox page ID',
  'regfox.connect': 'Connect to RegFox',
  'regfox.connected': 'Connected — {count} attendees found',
  'regfox.back': 'Back',
  'regfox.retry': 'Try again',
  'printer.title': 'Choose a printer',
  'printer.text': 'Select the Brother label printer for badges. You can skip this and print later.',
  'printer.select': 'Printer',
  'printer.test': 'Print test badge',
  'printer.skip': 'Continue without printer',
  'printer.continue': 'Continue',
  'printer.back': 'Back',
  'mobile.title': 'Set up phone meal scanners',
  'mobile.text': 'Volunteers scan badges on their phones. FoxBridge will send attendee data automatically.',
  'mobile.simpleText':
    'After setup, connect volunteer phones from the home screen with Connect a phone. Each volunteer scans one temporary QR code with the phone’s Camera app.',
  'mobile.skipForNow': 'Continue',
  'mobile.ready': 'Mobile scanner ready',
  'mobile.setupTitle': 'Mobile service setup',
  'mobile.serviceUrl': 'Cloud endpoint URL',
  'mobile.publicKey': 'Publishable client key',
  'mobile.desktopKey': 'Privileged desktop key (local only)',
  'mobile.conferenceId': 'Conference ID',
  'mobile.appUrl': 'Scanner web address',
  'mobile.appUrlHelp': 'This is the web address volunteers open on their phones.',
  'mobile.scannerUrl': 'FoxBridge Scanner web address (optional)',
  'mobile.testContinue': 'Test and continue',
  'mobile.technicalHelp': 'Technical help',
  'mobile.technicalText':
    'These fields connect FoxBridge to the hosted phone scanning service. The desktop connection key stays on this computer only.',
  'mobile.back': 'Back',
  'mobile.retry': 'Try again',
  'ready.title': 'Ready to go',
  'ready.text': 'Review your setup before opening the operations home screen.',
  'ready.attendees': '{count} attendees loaded',
  'ready.printerReady': 'Printer ready',
  'ready.printerUnavailable': 'Printer not set up',
  'ready.mobileReady': 'Mobile scanners ready',
  'ready.mobileLater': 'Connect phones later from the home screen',
  'ready.mobileNeeded': 'Connect phones later from the home screen',
  'ready.finish': 'Finish setup',
  'home.conference': 'Conference',
  'home.status.registration': 'Registration ready',
  'home.status.attendees': '{count} attendees loaded',
  'home.status.printerReady': 'Printer ready',
  'home.status.printerUnavailable': 'Printer unavailable',
  'home.status.mobileReady': 'Mobile scanners ready',
  'home.status.mobileNeeded': 'Phone scanning not connected',
  'home.status.lastUpdate': 'Last registration update',
  'home.action.refresh': 'Refresh registrations',
  'home.action.find': 'Find attendee',
  'home.action.print': 'Print badge',
  'home.action.validate': 'Validate meal',
  'home.action.connectPhone': 'Connect a phone',
  'home.action.mealDashboard': 'Meal Dashboard',
  'home.action.eventSettings': 'Event Settings',
  'home.action.foxbridgeSync': 'FoxBridge Sync',
  'home.action.update': 'Update registrations',
  'home.updating': 'Updating…',
  'home.status.syncConnected': 'FoxBridge Sync connected',
  'home.status.syncNeeded': 'FoxBridge Sync not connected',
  'home.status.syncReconnect': 'FoxBridge Sync needs to reconnect',
  'sync.title': 'FoxBridge Sync',
  'sync.text':
    'Connect this computer so phones and other desks stay in sync for this event. You only need a short enrollment code.',
  'sync.enterCodeHelp': 'Enter the enrollment code for this event.',
  'sync.codeLabel': 'Enrollment code',
  'sync.codePlaceholder': 'ABCD-EFGH-IJKL',
  'sync.connect': 'Connect',
  'sync.reconnect': 'Enter a new code',
  'sync.checking': 'Checking connection…',
  'sync.connecting': 'Connecting…',
  'sync.connected': 'Connected',
  'sync.connectedCheck': '✓ Connected',
  'sync.setupLater': 'Set up later',
  'sync.error.invalidCode':
    'That code did not work. Check the code and try again, or ask for a new one.',
  'sync.error.expiredCode': 'That code has expired. Ask for a new enrollment code and try again.',
  'sync.error.revoked':
    'This computer’s conference connection was revoked. Enter a new enrollment code to reconnect.',
  'sync.error.needsReconnect':
    'This computer needs to reconnect to FoxBridge Sync. Enter a new enrollment code.',
  'sync.error.unavailable': 'Unable to connect to FoxBridge Sync right now. Try again in a moment.',
  'ready.syncReady': 'FoxBridge Sync connected',
  'ready.syncLater': 'FoxBridge Sync can be connected later from the home screen',
  'connect.title': 'Connect a phone',
  'connect.loading': 'Creating pairing code…',
  'connect.setupNeeded': 'Phone scanning is not available yet.',
  'connect.setupButton': 'Open settings',
  'connect.serviceUnavailable': 'Phone scanning is not connected yet. Desktop registration is still available.',
  'connect.noPhoneUrl': 'A scanner web address is not set up yet.',
  'connect.configureWebAddress': 'Open settings',
  'connect.instruction': 'Scan this code with the phone’s Camera app.',
  'connect.waiting': 'Waiting for the phone…',
  'connect.renewing': 'That code expired. Creating a new one…',
  'connect.expiresIn': 'Code expires in {time}',
  'connect.expired': 'This code has expired. Create a new code.',
  'connect.newCode': 'Create a new code',
  'connect.phoneConnected': 'Phone connected and ready to scan.',
  'connect.unavailable': 'Phone scanning is not available right now. Desktop registration is still available.',
  'connect.startTestServer': 'Start mobile test server',
  'connect.testServerHint':
    'Run npm run dev:mobile in Terminal. Phone and computer must be on the same Wi-Fi.',
  'connect.localTesting':
    'Local testing address — phone and computer must be on the same Wi-Fi.',
  'connect.step1': 'Open FoxBridge Scanner on the phone.',
  'connect.step2': 'Scan this QR code to open the app.',
  'connect.step3': 'Enter the scanner code shown below.',
  'connect.step4': 'Scan an attendee badge.',
  'connect.scannerCode': 'Scanner code',
  'connect.mobileUrl': 'FoxBridge Scanner address',
  'connect.copy': 'Copy URL',
  'connect.copyCode': 'Copy code',
  'connect.copied': 'Copied',
  'connect.copiedCode': 'Copied',
  'connect.qrError': 'Could not generate the QR code. Use Copy URL instead.',
  'connect.close': 'Close',
  'settings.title': 'Settings',
  'settings.reopenSetup': 'Reopen setup wizard',
  'settings.advanced': 'Advanced',
  'settings.language': 'Language',
  'settings.showDesktopMealValidation': 'Show desktop meal validation',
  'settings.scannerWebAddress': 'Scanner web address',
  'settings.phoneServiceTitle': 'FoxBridge Cloud (development / migration)',
  'settings.cloudOverrideHelp':
    'Ordinary production desks enroll with a one-time FoxBridge Cloud code. Use the legacy URL/key fields below only for local development or migrating an older install. Do not put a service-role key in a distributed desktop build.',
  'settings.cloudEnrollTitle': 'FoxBridge Sync (fallback)',
  'settings.cloudEnrollHelp':
    'Prefer Connect FoxBridge Sync from the home screen or Setup. Use this only if those surfaces are unavailable.',
  'settings.cloudEnrollmentCode': 'Enrollment code',
  'settings.cloudEnrollButton': 'Connect',
  'settings.cloudEnrolled': 'This computer is connected to FoxBridge Sync.',
  'settings.saveAdvanced': 'Save advanced settings',
  'common.back': 'Back',
  'common.next': 'Next',
}

const es: Record<MessageKey, string> = {
  'welcome.title': 'Bienvenido a FoxBridge',
  'welcome.text': 'Preparemos su conferencia.',
  'welcome.start': 'Iniciar configuración',
  'language.title': 'Elija un idioma',
  'language.text': 'Elija el idioma que verán los voluntarios en la configuración y la pantalla principal.',
  'language.english': 'English',
  'language.spanish': 'Español',
  'language.continue': 'Continuar',
  'regfox.title': 'Conectar registro',
  'regfox.text': 'Ingrese sus credenciales de RegFox. FoxBridge se conectará y descargará asistentes automáticamente.',
  'regfox.apiKey': 'Clave API de RegFox',
  'regfox.pageId': 'ID de página de RegFox',
  'regfox.connect': 'Conectar a RegFox',
  'regfox.connected': 'Conectado — {count} asistentes encontrados',
  'regfox.back': 'Atrás',
  'regfox.retry': 'Intentar de nuevo',
  'printer.title': 'Elija una impresora',
  'printer.text': 'Seleccione la impresora Brother para credenciales. Puede omitir esto e imprimir después.',
  'printer.select': 'Impresora',
  'printer.test': 'Imprimir credencial de prueba',
  'printer.skip': 'Continuar sin impresora',
  'printer.continue': 'Continuar',
  'printer.back': 'Atrás',
  'mobile.title': 'Configurar escáneres de comidas en el teléfono',
  'mobile.text': 'Los voluntarios escanean credenciales en sus teléfonos. FoxBridge enviará los datos automáticamente.',
  'mobile.simpleText':
    'Después de la configuración, conecte teléfonos de voluntarios desde la pantalla principal con Conectar un teléfono. Cada voluntario escanea un código QR temporal con la app Cámara.',
  'mobile.skipForNow': 'Continuar',
  'mobile.ready': 'Escáner móvil listo',
  'mobile.setupTitle': 'Configuración del servicio móvil',
  'mobile.serviceUrl': 'URL del endpoint de Cloud',
  'mobile.publicKey': 'Clave publicable del cliente',
  'mobile.desktopKey': 'Clave privilegiada de escritorio (solo local)',
  'mobile.conferenceId': 'ID de conferencia',
  'mobile.appUrl': 'Dirección web del escáner',
  'mobile.appUrlHelp': 'Esta es la dirección web que los voluntarios abren en sus teléfonos.',
  'mobile.scannerUrl': 'Dirección web de FoxBridge Scanner (opcional)',
  'mobile.testContinue': 'Probar y continuar',
  'mobile.technicalHelp': 'Ayuda técnica',
  'mobile.technicalText':
    'Estos campos conectan FoxBridge al servicio alojado de escaneo por teléfono. La clave de escritorio permanece solo en esta computadora.',
  'mobile.back': 'Atrás',
  'mobile.retry': 'Intentar de nuevo',
  'ready.title': 'Listo para comenzar',
  'ready.text': 'Revise la configuración antes de abrir la pantalla principal.',
  'ready.attendees': '{count} asistentes cargados',
  'ready.printerReady': 'Impresora lista',
  'ready.printerUnavailable': 'Impresora no configurada',
  'ready.mobileReady': 'Escáneres móviles listos',
  'ready.mobileLater': 'Conecte teléfonos después desde la pantalla principal',
  'ready.mobileNeeded': 'Conecte teléfonos después desde la pantalla principal',
  'ready.finish': 'Finalizar configuración',
  'home.conference': 'Conferencia',
  'home.status.registration': 'Registro listo',
  'home.status.attendees': '{count} asistentes cargados',
  'home.status.printerReady': 'Impresora lista',
  'home.status.printerUnavailable': 'Impresora no disponible',
  'home.status.mobileReady': 'Escáneres móviles listos',
  'home.status.mobileNeeded': 'Escaneo por teléfono no conectado',
  'home.status.lastUpdate': 'Última actualización de registro',
  'home.action.refresh': 'Actualizar registros',
  'home.action.find': 'Buscar asistente',
  'home.action.print': 'Imprimir credencial',
  'home.action.validate': 'Validar comida',
  'home.action.connectPhone': 'Conectar un teléfono',
  'home.action.mealDashboard': 'Panel de comidas',
  'home.action.eventSettings': 'Configuración del evento',
  'home.action.foxbridgeSync': 'FoxBridge Sync',
  'home.action.update': 'Actualizar registros',
  'home.updating': 'Actualizando…',
  'home.status.syncConnected': 'FoxBridge Sync conectado',
  'home.status.syncNeeded': 'FoxBridge Sync no conectado',
  'home.status.syncReconnect': 'FoxBridge Sync necesita reconectarse',
  'sync.title': 'FoxBridge Sync',
  'sync.text':
    'Conecte esta computadora para que los teléfonos y otros escritorios se mantengan sincronizados en este evento. Solo necesita un código de inscripción corto.',
  'sync.enterCodeHelp': 'Ingrese el código de inscripción de este evento.',
  'sync.codeLabel': 'Código de inscripción',
  'sync.codePlaceholder': 'ABCD-EFGH-IJKL',
  'sync.connect': 'Conectar',
  'sync.reconnect': 'Ingresar un código nuevo',
  'sync.checking': 'Comprobando conexión…',
  'sync.connecting': 'Conectando…',
  'sync.connected': 'Conectado',
  'sync.connectedCheck': '✓ Conectado',
  'sync.setupLater': 'Configurar después',
  'sync.error.invalidCode':
    'Ese código no funcionó. Revise el código e intente de nuevo, o pida uno nuevo.',
  'sync.error.expiredCode':
    'Ese código venció. Pida un código de inscripción nuevo e intente de nuevo.',
  'sync.error.revoked':
    'Se revocó la conexión de esta computadora. Ingrese un código de inscripción nuevo para reconectar.',
  'sync.error.needsReconnect':
    'Esta computadora necesita reconectarse a FoxBridge Sync. Ingrese un código de inscripción nuevo.',
  'sync.error.unavailable':
    'No se pudo conectar a FoxBridge Sync ahora. Intente de nuevo en un momento.',
  'ready.syncReady': 'FoxBridge Sync conectado',
  'ready.syncLater': 'FoxBridge Sync se puede conectar después desde la pantalla principal',
  'connect.title': 'Conectar un teléfono',
  'connect.loading': 'Creando código de emparejamiento…',
  'connect.setupNeeded': 'El escaneo por teléfono aún no está disponible.',
  'connect.setupButton': 'Abrir configuración',
  'connect.serviceUnavailable':
    'El escaneo por teléfono aún no está conectado. El registro de escritorio sigue disponible.',
  'connect.noPhoneUrl': 'Aún no hay una dirección web del escáner configurada.',
  'connect.configureWebAddress': 'Abrir configuración',
  'connect.instruction': 'Escanee este código con la app Cámara del teléfono.',
  'connect.waiting': 'Esperando el teléfono…',
  'connect.renewing': 'Ese código venció. Creando uno nuevo…',
  'connect.expiresIn': 'El código vence en {time}',
  'connect.expired': 'Este código venció. Cree uno nuevo.',
  'connect.newCode': 'Crear un código nuevo',
  'connect.phoneConnected': 'Teléfono conectado y listo para escanear.',
  'connect.unavailable':
    'El escaneo por teléfono no está disponible ahora. El registro de escritorio sigue disponible.',
  'connect.startTestServer': 'Iniciar servidor de prueba móvil',
  'connect.testServerHint':
    'Ejecute npm run dev:mobile en Terminal. El teléfono y la computadora deben estar en la misma red Wi-Fi.',
  'connect.localTesting':
    'Dirección de prueba local — el teléfono y la computadora deben estar en la misma red Wi-Fi.',
  'connect.step1': 'Abra FoxBridge Scanner en el teléfono.',
  'connect.step2': 'Escanee este código QR para abrir la app.',
  'connect.step3': 'Ingrese el código de escáner que aparece abajo.',
  'connect.step4': 'Escanee la credencial de un asistente.',
  'connect.scannerCode': 'Código de escáner',
  'connect.mobileUrl': 'Dirección de FoxBridge Scanner',
  'connect.copy': 'Copiar URL',
  'connect.copyCode': 'Copiar código',
  'connect.copied': 'Copiado',
  'connect.copiedCode': 'Copiado',
  'connect.qrError': 'No se pudo generar el código QR. Use Copiar URL.',
  'connect.close': 'Cerrar',
  'settings.title': 'Configuración',
  'settings.reopenSetup': 'Reabrir asistente de configuración',
  'settings.advanced': 'Avanzado',
  'settings.language': 'Idioma',
  'settings.showDesktopMealValidation': 'Mostrar validación de comidas en escritorio',
  'settings.scannerWebAddress': 'Dirección web del escáner',
  'settings.phoneServiceTitle': 'FoxBridge Cloud (desarrollo / migración)',
  'settings.cloudOverrideHelp':
    'Las computadoras de producción se inscriben con un código de FoxBridge Cloud de un solo uso. Use los campos de URL/clave heredados solo para desarrollo local o para migrar una instalación anterior. No ponga una clave de servicio en una compilación de escritorio distribuida.',
  'settings.cloudEnrollTitle': 'FoxBridge Sync (alternativa)',
  'settings.cloudEnrollHelp':
    'Prefiera Conectar FoxBridge Sync desde la pantalla principal o la configuración inicial. Use esto solo si esas pantallas no están disponibles.',
  'settings.cloudEnrollmentCode': 'Código de inscripción',
  'settings.cloudEnrollButton': 'Conectar',
  'settings.cloudEnrolled': 'Esta computadora está conectada a FoxBridge Sync.',
  'settings.saveAdvanced': 'Guardar configuración avanzada',
  'common.back': 'Atrás',
  'common.next': 'Siguiente',
}

const catalogs: Record<AppLanguage, Record<MessageKey, string>> = { en, es }

export function translate(
  language: AppLanguage,
  key: MessageKey,
  values?: Record<string, string | number>,
): string {
  const template = catalogs[language][key] ?? catalogs.en[key] ?? key
  if (!values) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_match, token: string) =>
    String(values[token] ?? `{${token}}`),
  )
}
