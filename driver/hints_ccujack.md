## Hinweise zum ccujack Treiber:

Der Treiber bietet eine direkte Anbindung an eine HomeMatic CCU über das Addon CCU-Jack an. Das Addon muss vorher auf der CCU installiert und eingerichtet werden. Es werden keine Serien und die UZSU-Widgets unterstützt.
In den Einstellungen müssen IP-Adresse, Hostname und zusätzlich Benutername und Passwort für die Verbindung mit CCU-Jack angegeben werden. Eine sichere SSL-Verbindung sollte auch möglich sein, wenn das Zertifikat für CCU-Jack vom Browser gespeichert wurde.

Die Namen der Items müssen nach folgendem Schema angegeben werden:

### Typ.Seriennummer.Kanalnummer.Parameter

Beispiele:

- {{ basic.print('', 'device.000000000000000.1.ACTUAL_TEMPERATURE', '°c') }}
- {{ basic.stateswitch('Licht', 'virtdev.JACK000001.2.STATE', 'icon', ['1', '0'], '', '', '') }}

Da die CCU bei z.B. Rolladenaktoren oder Dimmern Werte im Bereich von 0 bis 1 zurückgibt bzw. erwartet, müssen hier abweichend von der Beschreibung andere Werte angegeben werden (z.B beim Slider oder auch Stateswitch).

Beispiel:
           
- {{ basic.slider('', 'virtdev.JACK000003.1.LEVEL', 0, 1, 0.1, '', '', '', '', 0) }}

Bei Rolladenaktoren ist weiterhin darauf zu achten, dass der Wert *1* für den Parameter LEVEL 'offen' und der Wert *0* 'geschlossen' bedeutet. Das Rollo-Widget von smartVISU kann also nicht direkt verwendet werden.

Beispiel für einen Basic Slider:

- {{ basic.slider('', 'device.000000000000000.4.LEVEL', 1, 0, 0.1, '', '', '', '', 0) }}

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


