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
  | 'sync.setup'
  | 'sync.retry'
  | 'sync.joinExisting'
  | 'sync.joinHelp'
  | 'sync.joinCodeLabel'
  | 'sync.joinConnect'
  | 'sync.deviceNameLabel'
  | 'sync.deviceNamePlaceholder'
  | 'sync.setupMyEvent'
  | 'sync.ownershipHelp'
  | 'sync.ownershipApiKey'
  | 'sync.ownershipEventId'
  | 'sync.backToSetup'
  | 'sync.reconnect'
  | 'sync.checking'
  | 'sync.connecting'
  | 'sync.connected'
  | 'sync.connectedCheck'
  | 'sync.connectedPrincipal'
  | 'sync.connectedLegacy'
  | 'sync.connectedLinked'
  | 'sync.connectedUntil'
  | 'sync.upgrade.action'
  | 'sync.upgrade.explain'
  | 'sync.setupLater'
  | 'sync.transfer.explain'
  | 'sync.transfer.warning'
  | 'sync.transfer.confirm'
  | 'sync.transfer.cancel'
  | 'sync.error.invalidCode'
  | 'sync.error.expiredCode'
  | 'sync.error.revoked'
  | 'sync.error.needsReconnect'
  | 'sync.error.unavailable'
  | 'sync.error.verificationFailed'
  | 'sync.error.cloudUnavailable'
  | 'sync.error.needsRetry'
  | 'sync.upstream.ok'
  | 'sync.upstream.pending'
  | 'sync.upstream.attention'
  | 'home.status.syncConnected'
  | 'home.status.syncConnectedPrincipal'
  | 'home.status.syncConnectedLegacy'
  | 'home.status.syncConnectedLinked'
  | 'home.status.syncNeeded'
  | 'home.status.syncReconnect'
  | 'home.action.foxbridgeSync'
  | 'home.action.connectedDesks'
  | 'desks.title'
  | 'desks.text'
  | 'desks.loading'
  | 'desks.principalOnly'
  | 'desks.unnamed'
  | 'desks.thisComputer'
  | 'desks.role.principal'
  | 'desks.role.linked'
  | 'desks.role.legacy'
  | 'desks.state.active'
  | 'desks.state.until'
  | 'desks.state.expired'
  | 'desks.state.revoked'
  | 'desks.revoke'
  | 'desks.revoking'
  | 'desks.inviteTitle'
  | 'desks.generateCode'
  | 'desks.issuing'
  | 'desks.codeInstruction'
  | 'desks.codeExpiresIn'
  | 'desks.codeExpired'
  | 'desks.error.load'
  | 'desks.error.issue'
  | 'desks.error.revoke'
  | 'eventConnect.title'
  | 'eventConnect.text'
  | 'eventConnect.setupMyEventHelp'
  | 'eventConnect.joinHelp'
  | 'eventConnect.principalFieldsRequired'
  | 'eventConnect.principalFailed'
  | 'eventConnect.joinCodeRequired'
  | 'eventConnect.joinFailed'
  | 'ready.syncLinked'
  | 'settings.lockEventTitle'
  | 'settings.lockEventBody'
  | 'settings.lockEventCancel'
  | 'settings.lockEventConfirm'
  | 'ready.syncReady'
  | 'ready.syncLater'
  | 'connect.close'
  | 'settings.title'
  | 'settings.reopenSetup'
  | 'settings.advanced'
  | 'settings.language'
  | 'settings.update.title'
  | 'settings.update.upToDate'
  | 'settings.update.version'
  | 'settings.update.checkForUpdates'
  | 'settings.update.checkAgain'
  | 'settings.update.devDisabled'
  | 'settings.update.checking'
  | 'settings.update.available'
  | 'settings.update.usingVersion'
  | 'settings.update.updateNow'
  | 'settings.update.downloading'
  | 'settings.update.downloadProgress'
  | 'settings.update.readyToInstall'
  | 'settings.update.restartAndUpdate'
  | 'settings.update.restartTitle'
  | 'settings.update.restartBody'
  | 'settings.update.restartCancel'
  | 'settings.update.restartConfirm'
  | 'settings.update.tryAgain'
  | 'settings.update.errorFallback'
  | 'settings.update.badgeLabel'
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
  'home.action.connectedDesks': 'Connected Desktops',
  'home.action.update': 'Update registrations',
  'home.updating': 'Updating…',
  'home.status.syncConnected': 'FoxBridge Sync connected',
  'home.status.syncConnectedPrincipal': 'Connected — Principal Desktop',
  'home.status.syncConnectedLegacy': 'Connected — legacy desk',
  'home.status.syncConnectedLinked': 'Connected — temporary desk',
  'home.status.syncNeeded': 'FoxBridge Sync not connected',
  'home.status.syncReconnect': 'FoxBridge Sync needs to reconnect',
  'sync.title': 'FoxBridge Sync',
  'sync.text':
    'Connect this computer so phones and other desks stay in sync for this event. Join with a connection code, or set up your event as the Principal Desktop by proving RegFox ownership.',
  'sync.enterCodeHelp':
    'Enter the connection code from the Principal Desktop for this event.',
  'sync.codeLabel': 'Enrollment code',
  'sync.codePlaceholder': 'ABCD-EFGH-IJKL',
  'sync.connect': 'Connect',
  'sync.setup': 'Set up FoxBridge Sync',
  'sync.retry': 'Try again',
  'sync.joinExisting': 'Join an existing FoxBridge Event',
  'sync.joinHelp':
    'Enter the one-time connection code from the Principal Desktop for this event.',
  'sync.joinCodeLabel': 'Connection code',
  'sync.joinConnect': 'Join event',
  'sync.deviceNameLabel': 'Computer name (optional)',
  'sync.deviceNamePlaceholder': 'Registration desk 2',
  'sync.setupMyEvent': 'Set up my event',
  'sync.ownershipHelp':
    'To become the Principal Desktop, enter your RegFox API key and event ID. FoxBridge Cloud verifies access to that exact event before granting Principal.',
  'sync.ownershipApiKey': 'RegFox API key',
  'sync.ownershipEventId': 'RegFox event ID',
  'sync.backToSetup': 'Back',
  'sync.reconnect': 'Enter a new code',
  'sync.checking': 'Checking connection…',
  'sync.connecting': 'Connecting…',
  'sync.connected': 'Connected',
  'sync.connectedCheck': '✓ Connected',
  'sync.connectedPrincipal': '✓ Connected — Principal Desktop',
  'sync.connectedLegacy': '✓ Connected — legacy desk',
  'sync.connectedLinked': '✓ Connected — temporary desk',
  'sync.connectedUntil': 'Connected until {when}',
  'sync.upgrade.action': 'Make this the Principal Desktop',
  'sync.upgrade.explain':
    'Principal Desktop can connect and manage other computers for this event. FoxBridge will verify your RegFox access for this event.',
  'sync.setupLater': 'Set up later',
  'sync.transfer.explain':
    'Another computer is already set as the Principal Desktop for this event.',
  'sync.transfer.warning':
    'If you continue, this computer becomes the Principal Desktop and the previous one loses Principal status. Transfer confirmation is not ownership proof — RegFox access was already verified.',
  'sync.transfer.confirm': 'Make this computer the Principal',
  'sync.transfer.cancel': 'Cancel',
  'sync.error.invalidCode':
    'That code did not work. Check the code and try again, or ask for a new one.',
  'sync.error.expiredCode': 'That code has expired. Ask for a new connection code and try again.',
  'sync.error.revoked':
    'This computer’s conference connection was revoked. Join again with a new connection code, or set up your event by proving RegFox ownership.',
  'sync.error.needsReconnect':
    'This computer needs to reconnect to FoxBridge Sync. Join with a connection code, or set up your event as Principal.',
  'sync.error.unavailable': 'Unable to connect to FoxBridge Sync right now. Try again in a moment.',
  'sync.error.verificationFailed':
    'FoxBridge could not verify RegFox access for this event. Check your RegFox API key and event ID and try again.',
  'sync.error.cloudUnavailable':
    'FoxBridge Sync is temporarily unavailable. Try again in a moment.',
  'sync.error.needsRetry': 'Something went wrong. Try again in a moment.',
  'sync.upstream.ok': 'Upstream sync: OK',
  'sync.upstream.pending': '{count} check-ins waiting for registration sync',
  'sync.upstream.attention': '{count} check-ins need attention',
  'desks.title': 'Connected Desktops',
  'desks.text': 'Manage computers connected to FoxBridge Sync for this event.',
  'desks.loading': 'Loading connected computers…',
  'desks.principalOnly': 'Only the Principal Desktop can manage connected computers.',
  'desks.unnamed': 'Unnamed computer',
  'desks.thisComputer': 'this computer',
  'desks.role.principal': 'Principal',
  'desks.role.linked': 'Temporary',
  'desks.role.legacy': 'Legacy',
  'desks.state.active': 'Active',
  'desks.state.until': 'Until {when}',
  'desks.state.expired': 'Expired',
  'desks.state.revoked': 'Disconnected',
  'desks.revoke': 'Disconnect',
  'desks.revoking': 'Disconnecting…',
  'desks.inviteTitle': 'Connect another computer',
  'desks.generateCode': 'Create connection code',
  'desks.issuing': 'Creating code…',
  'desks.codeInstruction': 'Enter this code on the computer you want to connect.',
  'desks.codeExpiresIn': 'Expires in {time}',
  'desks.codeExpired': 'This connection code has expired. Create a new one.',
  'desks.error.load': 'Unable to load connected computers.',
  'desks.error.issue': 'Unable to create a connection code.',
  'desks.error.revoke': 'Unable to disconnect that computer.',
  'ready.syncReady': 'FoxBridge Sync connected',
  'ready.syncLater': 'FoxBridge Sync can be connected later from the home screen',
  'ready.syncLinked': 'Joined as a temporary Linked Desktop',
  'eventConnect.title': 'Connect to your event',
  'eventConnect.text': 'Choose how this computer connects to a FoxBridge Event.',
  'eventConnect.setupMyEventHelp':
    'For the organizer setting up the main FoxBridge computer.',
  'eventConnect.joinHelp':
    'For another computer joining an event already set up in FoxBridge. Ask the Principal Desktop for a connection code.',
  'eventConnect.principalFieldsRequired': 'Enter both the RegFox API key and page ID.',
  'eventConnect.principalFailed': 'Could not set up this event. Check your credentials and try again.',
  'eventConnect.joinCodeRequired': 'Enter the connection code from the Principal Desktop.',
  'eventConnect.joinFailed': 'Could not join with that connection code.',
  'settings.lockEventTitle': 'Return to event setup?',
  'settings.lockEventBody':
    'Continuing will lock the current event on this computer.\n\nYour saved attendee data, meal history, badge history, and event settings will remain saved.\n\nTo access the event again, you will need either:\n• your registration-platform credentials, or\n• a new connection code from the Principal Desktop.',
  'settings.lockEventCancel': 'Cancel',
  'settings.lockEventConfirm': 'Lock Event & Continue',
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
  'settings.cloudEnrollTitle': 'FoxBridge Sync (operator enrollment)',
  'settings.cloudEnrollHelp':
    'Legacy support/dev fallback. Ordinary organizers should Join an existing event or Set up my event from FoxBridge Sync. Operator enrollment codes create a legacy desk and never grant Principal by themselves.',
  'settings.cloudEnrollmentCode': 'Enrollment code',
  'settings.cloudEnrollButton': 'Connect',
  'settings.cloudEnrolled': 'This computer is connected to FoxBridge Sync.',
  'settings.saveAdvanced': 'Save advanced settings',
  'settings.update.title': 'Software Update',
  'settings.update.upToDate': 'FoxBridge is up to date',
  'settings.update.version': 'Version {version}',
  'settings.update.checkForUpdates': 'Check for Updates',
  'settings.update.checkAgain': 'Check Again',
  'settings.update.devDisabled': 'Software updates are available in packaged builds.',
  'settings.update.checking': 'Checking for updates…',
  'settings.update.available': 'FoxBridge {version} is available',
  'settings.update.usingVersion': 'You are using {version}',
  'settings.update.updateNow': 'Update Now',
  'settings.update.downloading': 'Downloading update…',
  'settings.update.downloadProgress': '{percent}%',
  'settings.update.readyToInstall': 'FoxBridge {version} is ready to install',
  'settings.update.restartAndUpdate': 'Restart & Update',
  'settings.update.restartTitle': 'Restart FoxBridge to install update?',
  'settings.update.restartBody':
    'FoxBridge will close and restart to install the update.\nYour saved event data and settings will remain on this computer.',
  'settings.update.restartCancel': 'Cancel',
  'settings.update.restartConfirm': 'Restart & Update',
  'settings.update.tryAgain': 'Try Again',
  'settings.update.errorFallback': 'Unable to check for updates right now.',
  'settings.update.badgeLabel': 'Settings — update available',
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
  'home.action.connectedDesks': 'Escritorios conectados',
  'home.action.update': 'Actualizar registros',
  'home.updating': 'Actualizando…',
  'home.status.syncConnected': 'FoxBridge Sync conectado',
  'home.status.syncConnectedPrincipal': 'Conectado — Escritorio principal',
  'home.status.syncConnectedLegacy': 'Conectado — escritorio heredado',
  'home.status.syncConnectedLinked': 'Conectado — escritorio temporal',
  'home.status.syncNeeded': 'FoxBridge Sync no conectado',
  'home.status.syncReconnect': 'FoxBridge Sync necesita reconectarse',
  'sync.title': 'FoxBridge Sync',
  'sync.text':
    'Conecte esta computadora para que los teléfonos y otros escritorios se mantengan sincronizados en este evento. Únase con un código de conexión, o configure su evento como Escritorio principal demostrando propiedad de RegFox.',
  'sync.enterCodeHelp':
    'Ingrese el código de conexión del Escritorio principal de este evento.',
  'sync.codeLabel': 'Código de inscripción',
  'sync.codePlaceholder': 'ABCD-EFGH-IJKL',
  'sync.connect': 'Conectar',
  'sync.setup': 'Configurar FoxBridge Sync',
  'sync.retry': 'Intentar de nuevo',
  'sync.joinExisting': 'Unirse a un evento FoxBridge existente',
  'sync.joinHelp':
    'Ingrese el código de conexión de un solo uso del Escritorio principal de este evento.',
  'sync.joinCodeLabel': 'Código de conexión',
  'sync.joinConnect': 'Unirse al evento',
  'sync.deviceNameLabel': 'Nombre de la computadora (opcional)',
  'sync.deviceNamePlaceholder': 'Mesa de registro 2',
  'sync.setupMyEvent': 'Configurar mi evento',
  'sync.ownershipHelp':
    'Para convertirse en el Escritorio principal, ingrese su clave API de RegFox y el ID del evento. FoxBridge Cloud verifica el acceso a ese evento exacto antes de conceder Principal.',
  'sync.ownershipApiKey': 'Clave API de RegFox',
  'sync.ownershipEventId': 'ID de evento de RegFox',
  'sync.backToSetup': 'Atrás',
  'sync.reconnect': 'Ingresar un código nuevo',
  'sync.checking': 'Comprobando conexión…',
  'sync.connecting': 'Conectando…',
  'sync.connected': 'Conectado',
  'sync.connectedCheck': '✓ Conectado',
  'sync.connectedPrincipal': '✓ Conectado — Escritorio principal',
  'sync.connectedLegacy': '✓ Conectado — escritorio heredado',
  'sync.connectedLinked': '✓ Conectado — escritorio temporal',
  'sync.connectedUntil': 'Conectado hasta {when}',
  'sync.upgrade.action': 'Convertir esta en el Escritorio principal',
  'sync.upgrade.explain':
    'El Escritorio principal puede conectar y administrar otras computadoras de este evento. FoxBridge verificará su acceso a RegFox para este evento.',
  'sync.setupLater': 'Configurar después',
  'sync.transfer.explain':
    'Otra computadora ya está configurada como el Escritorio principal de este evento.',
  'sync.transfer.warning':
    'Si continúa, esta computadora se convierte en el Escritorio principal y la anterior pierde ese estado. La confirmación de transferencia no es prueba de propiedad — el acceso a RegFox ya fue verificado.',
  'sync.transfer.confirm': 'Hacer de esta el Escritorio principal',
  'sync.transfer.cancel': 'Cancelar',
  'sync.error.invalidCode':
    'Ese código no funcionó. Revise el código e intente de nuevo, o pida uno nuevo.',
  'sync.error.expiredCode':
    'Ese código venció. Pida un código de conexión nuevo e intente de nuevo.',
  'sync.error.revoked':
    'Se revocó la conexión de esta computadora. Únase de nuevo con un código nuevo, o configure su evento demostrando propiedad de RegFox.',
  'sync.error.needsReconnect':
    'Esta computadora necesita reconectarse a FoxBridge Sync. Únase con un código de conexión, o configure su evento como Principal.',
  'sync.error.unavailable':
    'No se pudo conectar a FoxBridge Sync ahora. Intente de nuevo en un momento.',
  'sync.error.verificationFailed':
    'FoxBridge no pudo verificar el acceso a RegFox para este evento. Revise su clave API e ID de evento e intente de nuevo.',
  'sync.error.cloudUnavailable':
    'FoxBridge Sync no está disponible temporalmente. Intente de nuevo en un momento.',
  'sync.error.needsRetry': 'Algo salió mal. Intente de nuevo en un momento.',
  'sync.upstream.ok': 'Sincronización upstream: OK',
  'sync.upstream.pending':
    '{count} registros pendientes de sincronización con la plataforma',
  'sync.upstream.attention': '{count} registros necesitan atención',
  'desks.title': 'Escritorios conectados',
  'desks.text': 'Administre las computadoras conectadas a FoxBridge Sync para este evento.',
  'desks.loading': 'Cargando computadoras conectadas…',
  'desks.principalOnly': 'Solo el Escritorio principal puede administrar computadoras conectadas.',
  'desks.unnamed': 'Computadora sin nombre',
  'desks.thisComputer': 'esta computadora',
  'desks.role.principal': 'Principal',
  'desks.role.linked': 'Temporal',
  'desks.role.legacy': 'Heredado',
  'desks.state.active': 'Activo',
  'desks.state.until': 'Hasta {when}',
  'desks.state.expired': 'Vencido',
  'desks.state.revoked': 'Desconectado',
  'desks.revoke': 'Desconectar',
  'desks.revoking': 'Desconectando…',
  'desks.inviteTitle': 'Conectar otra computadora',
  'desks.generateCode': 'Crear código de conexión',
  'desks.issuing': 'Creando código…',
  'desks.codeInstruction': 'Ingrese este código en la computadora que desea conectar.',
  'desks.codeExpiresIn': 'Vence en {time}',
  'desks.codeExpired': 'Este código de conexión venció. Cree uno nuevo.',
  'desks.error.load': 'No se pudieron cargar las computadoras conectadas.',
  'desks.error.issue': 'No se pudo crear un código de conexión.',
  'desks.error.revoke': 'No se pudo desconectar esa computadora.',
  'ready.syncReady': 'FoxBridge Sync conectado',
  'ready.syncLater': 'FoxBridge Sync se puede conectar después desde la pantalla principal',
  'ready.syncLinked': 'Unido como escritorio vinculado temporal',
  'eventConnect.title': 'Conectar a tu evento',
  'eventConnect.text': 'Elija cómo esta computadora se conecta a un evento FoxBridge.',
  'eventConnect.setupMyEventHelp':
    'Para el organizador que configura la computadora principal de FoxBridge.',
  'eventConnect.joinHelp':
    'Para otra computadora que se une a un evento ya configurado en FoxBridge. Pida un código de conexión al escritorio Principal.',
  'eventConnect.principalFieldsRequired': 'Ingrese la clave API de RegFox y el ID de página.',
  'eventConnect.principalFailed':
    'No se pudo configurar este evento. Verifique sus credenciales e intente de nuevo.',
  'eventConnect.joinCodeRequired': 'Ingrese el código de conexión del escritorio Principal.',
  'eventConnect.joinFailed': 'No se pudo unir con ese código de conexión.',
  'settings.lockEventTitle': '¿Volver a la configuración del evento?',
  'settings.lockEventBody':
    'Continuar bloqueará el evento actual en esta computadora.\n\nLos datos de asistentes, historial de comidas, historial de gafetes y la configuración del evento se conservarán.\n\nPara acceder de nuevo necesitará:\n• las credenciales de la plataforma de registro, o\n• un nuevo código de conexión del escritorio Principal.',
  'settings.lockEventCancel': 'Cancelar',
  'settings.lockEventConfirm': 'Bloquear evento y continuar',
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
  'settings.cloudEnrollTitle': 'FoxBridge Sync (inscripción de operador)',
  'settings.cloudEnrollHelp':
    'Respaldo legado para soporte/desarrollo. Los organizadores deben Unirse a un evento existente o Configurar mi evento desde FoxBridge Sync. Los códigos de inscripción de operador crean un escritorio heredado y nunca conceden Principal por sí solos.',
  'settings.cloudEnrollmentCode': 'Código de inscripción',
  'settings.cloudEnrollButton': 'Conectar',
  'settings.cloudEnrolled': 'Esta computadora está conectada a FoxBridge Sync.',
  'settings.saveAdvanced': 'Guardar configuración avanzada',
  'settings.update.title': 'Actualización de software',
  'settings.update.upToDate': 'FoxBridge está actualizado',
  'settings.update.version': 'Versión {version}',
  'settings.update.checkForUpdates': 'Buscar actualizaciones',
  'settings.update.checkAgain': 'Buscar de nuevo',
  'settings.update.devDisabled':
    'Las actualizaciones de software están disponibles en las versiones empaquetadas.',
  'settings.update.checking': 'Buscando actualizaciones…',
  'settings.update.available': 'FoxBridge {version} está disponible',
  'settings.update.usingVersion': 'Está usando la versión {version}',
  'settings.update.updateNow': 'Actualizar ahora',
  'settings.update.downloading': 'Descargando actualización…',
  'settings.update.downloadProgress': '{percent}%',
  'settings.update.readyToInstall': 'FoxBridge {version} está listo para instalar',
  'settings.update.restartAndUpdate': 'Reiniciar y actualizar',
  'settings.update.restartTitle': '¿Reiniciar FoxBridge para instalar la actualización?',
  'settings.update.restartBody':
    'FoxBridge se cerrará y reiniciará para instalar la actualización.\nSus datos del evento y la configuración guardados permanecerán en esta computadora.',
  'settings.update.restartCancel': 'Cancelar',
  'settings.update.restartConfirm': 'Reiniciar y actualizar',
  'settings.update.tryAgain': 'Intentar de nuevo',
  'settings.update.errorFallback': 'No se pueden buscar actualizaciones en este momento.',
  'settings.update.badgeLabel': 'Configuración — actualización disponible',
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
