## Hinweise zum ccujack Treiber:

Der Treiber bietet eine direkte Anbindung an eine HomeMatic CCU über das Addon CCU-Jack an. Das Addon muss vorher auf der CCU installiert und eingerichtet werden. 

https://github.com/mdzio/ccu-jack

Es werden keine Serien und die UZSU-Widgets unterstützt.
In den Einstellungen müssen IP-Adresse, Hostname und zusätzlich Benutername und Passwort für die Verbindung mit CCU-Jack angegeben werden. Eine sichere SSL-Verbindung sollte auch möglich sein, wenn das Zertifikat für CCU-Jack vom Browser gespeichert wurde. Dazu muss einmal im Browser die die Webpage von CCU-Jack aufgerufen werden (https://IP-Addresse-CCU:2122) und bei selbstsignierten Zertifikaten die Ausnahmen bestätigt werden.

Die Namen der Items müssen nach folgendem Schema angegeben werden:

### Typ.Seriennummer.Kanalnummer.Parameter

Beispiele:

- {{ basic.print('', 'device.000000000000000.1.ACTUAL_TEMPERATURE', '°c') }}
- {{ basic.stateswitch('Licht', 'virtdev.JACK000001.2.STATE', 'icon', ['1', '0'], '', '', '') }}

Die CCU erwartet bei z.B. Rolladenaktoren oder Dimmern Werte im Bereich von 0 bis 1. Diese werden im Treiber in Prozentwerte von 0 bis 100 umgerechnet.
	
Ein Slider kann wie folgt angelegt werden:
           
- {{ basic.slider('', 'virtdev.JACK000003.1.LEVEL', 0, 100, 1, '', '', '', '', 0) }}

Bei Rolladenaktoren ist darauf zu achten, dass der Wert *100* für den Parameter LEVEL 'offen' und der Wert *0* 'geschlossen' bedeutet. Das Rollo-Widget 'smallshut' von smartVISU kann also nicht direkt verwendet werden, da hier die Werte für 'offen' (0) und 'geschlossen' (100) fest vorgegeben sind. Alle anderen Widgets, bei denen die Werte für 'min', 'max' und 'step' angegeben werden können, sollten aber 

Beispiel für einen Basic Slider (Verwendung mit Rolladenaktoren):

- {{ basic.slider('', 'device.000000000000000.4.LEVEL', 100, 0, 1, '', '', '', '', 0) }}
	
Beispiel für einen Basic Stateswitch (Verwendung mit Rolladenaktoren):
	
- {{ basic.stateswitch('',  'device.000000000000000.4.LEVEL', '', '100', 'carat-u') }}

Das Log-Widget kann man mit Systemvariablen nutzen.
Um z.B. den Batteriestatus verschiedener Geräte in smartVISU anzeigen zu lassen, muss man eine Systemvariable "Batteriestatus" (Variablentyp ist Zeichenkette) anlegen. Danach legt man ein Programm an, das z.B. periodisch folgendes Skript ausführt. Die Log-Daten werden in der Systemvariable "Batteriestatus" entsprechend formatiert gespeichert.


```ruby
var battWarn = dom.GetObject("Batteriestatus");
object oTmpArray = dom.GetObject(ID_SERVICES);
if(oTmpArray) {
	string sTmp;
	string sdesc;
  string all = "[";
	foreach(sTmp, oTmpArray.EnumIDs()) {
    object oTmp = dom.GetObject(sTmp);
    if (oTmp) {
      object trigDP = dom.GetObject(oTmp.AlTriggerDP());
      if ((trigDP.HssType() == "LOWBAT") || (trigDP.HssType() == "LOW_BAT")) {
        object och = dom.GetObject((trigDP.Channel()));
        object odev = dom.GetObject((och.Device()));
        string level = "info";
        string msg = odev # ": Batterie ist ok.";
        if (trigDP.Value()) {
          level = "warning";
          msg = odev # ": Batterie ist schwach.";
        }
        if (trigDP.Timestamp().ToInteger() > 0) {
          all = all # "{\"time\":" # trigDP.Timestamp().ToInteger() # "000, \"level\":\"" # level # "\", \"message\":\"" # msg # "\"},";
        }
      }
		}
	}
  all = all.RTrim(",");
  all = all # "]";
  battWarn.Variable(all);
}
```

In smartVISU kann das Log-Widget wie folgt angelegt werden:
	
- {{ status.log('', 'sysvar.10000', 10) }}
	
Die Nummer der Systemvariable (sysvar) kann man im Navigator auf der Webpage von CCU-Jack nachschauen.


Das Trigger-Widget kann eingesetzt werden, um z.B. Programme auf der CCU auszulösen oder Werte in vorhandene Systemvariablen zu schreiben.

Beispiele:

- {{ basic.trigger('', sysvar.10000', '', '', 10) }} 
- {{ basic.trigger('', program.123', '', '', 1) }} 
