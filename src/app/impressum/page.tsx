import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum & Datenschutz | CIMDATA Studienplaner",
  description:
    "Impressum und Datenschutzhinweise gemäß TMG und DSGVO für den CIMDATA Studienplaner."
};

export default function ImpressumPage() {
  return (
    <main className="app-shell legal-page">
      <header className="hero legal-hero">
        <p className="eyebrow">Rechtliches</p>
        <h1>Impressum &amp; Datenschutz</h1>
        <p className="hero-copy">
          Pflichtangaben nach dem Telemediengesetz (TMG) sowie
          transparenter Datenschutz nach der Datenschutz-Grundverordnung
          (DSGVO).
        </p>
      </header>

      <article className="legal-article">
        <section className="legal-section" aria-labelledby="impressum-heading">
          <h2 id="impressum-heading">Impressum</h2>
          <p>Angaben gemäß § 5 TMG:</p>
          <address className="legal-address">
            Henrik Heil
            <br />
            Westendstraße 100
            <br />
            60325 Frankfurt am Main
            <br />
            Deutschland
          </address>
          <p>
            <strong>Kontakt:</strong>{" "}
            <a
              href="mailto:contact@henrikheil.net"
              className="legal-inline-link"
            >
              contact@henrikheil.net
            </a>
          </p>
        </section>

        <section className="legal-section" aria-labelledby="haftung-inhalt-heading">
          <h2 id="haftung-inhalt-heading">Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter bin ich gemäß § 7 Abs. 1 TMG für eigene
            Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
            verantwortlich. Nach §§ 8 bis 10 TMG bin ich als Diensteanbieter
            jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen oder nach Umständen zu forschen, die auf
            eine rechtswidrige Tätigkeit hinweisen.
          </p>
          <p>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
            Informationen nach den allgemeinen Gesetzen bleiben hiervon
            unberührt. Eine diesbezügliche Haftung ist erst ab dem Zeitpunkt der
            Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
            von entsprechenden Rechtsverletzungen entferne ich diese Inhalte
            unverzüglich.
          </p>
        </section>

        <section className="legal-section" aria-labelledby="haftung-links-heading">
          <h2 id="haftung-links-heading">Haftung für Links</h2>
          <p>
            Dieses Angebot enthält Verknüpfungen zu Websites Dritter
            (&quot;externe Links&quot;). Auf die Inhalte dieser verlinkten
            Websites habe ich keinen Einfluss. Deshalb kann ich für diese
            fremden Inhalte keine Gewähr übernehmen. Für die Inhalte der
            verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
            Seiten verantwortlich. Zum Zeitpunkt der Verlinkung wurden die
            fremden Inhalte auf mögliche Rechtsverstöße überprüft; rechtswidrige
            Inhalte waren zu diesem Zeitpunkt nicht erkennbar. Bei Bekanntwerden
            von Rechtsverletzungen entferne ich derartige Links unverzüglich.
          </p>
        </section>

        <section className="legal-section" aria-labelledby="datenschutz-heading">
          <h2 id="datenschutz-heading">Datenschutz</h2>

          <h3 className="legal-subheading" id="verantwortlicher-heading">
            Verantwortlicher
          </h3>
          <p>
            Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne
            der DSGVO ist:
          </p>
          <address className="legal-address">
            Henrik Heil
            <br />
            Westendstraße 100
            <br />
            60325 Frankfurt am Main
            <br />
            Deutschland
          </address>
          <p>
            <a
              href="mailto:contact@henrikheil.net"
              className="legal-inline-link"
            >
              contact@henrikheil.net
            </a>
          </p>

          <h3 className="legal-subheading" id="zwecke-heading">
            Zwecke und Rechtsgrundlagen
          </h3>
          <p>
            Personenbezogene Daten werden nur verarbeitet, soweit dies zur
            Bereitstellung einer funktionsfähigen Website sowie der Inhalte und
            Leistungen erforderlich ist. Die Verarbeitung erfolgt regelmäßig nur
            auf Grundlage einer gesetzlichen Erlaubnis, insbesondere Ihrer
            Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO oder zur Wahrung
            eines berechtigten Interesses gemäß Art. 6 Abs. 1 lit. f DSGVO (z.&nbsp;B.
            Betrieb und Absicherung des Onlineangebots).
          </p>

          <h3 className="legal-subheading" id="hosting-heading">
            Hosting und Server-Logfiles
          </h3>
          <p>
            Diese Website wird auf technischer Infrastruktur eines Hosting-Anbieters
            betrieben. Beim Aufruf dieser oder anderer Seiten dieses Angebots
            kann der Hosting-Anbieter automatisch Informationen in sogenannten
            Server-Logdateien speichern, z.&nbsp;B. Browsertyp und -version,
            verwendetes Betriebssystem, Referrer-URL, Hostname des zugreifenden
            Rechners, Uhrzeit der Serveranfrage und die IP-Adresse. Die
            Verarbeitung dient der technischen Bereitstellung des Dienstes, der
            Stabilität und Sicherheit (z.&nbsp;B. zur Abwehr von Angriffen). Die
            Daten werden in der Regel nach einer begrenzten Speicherdauer
            gelöscht, soweit sie nicht zu Beweiszwecken länger aufbewahrt werden
            müssen.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
            an einem sicheren und effizienten Betrieb der Website). Näheres zu
            Speicherdauer und weiteren Verarbeitungen entnehmen Sie bitte der
            Datenschutzerklärung Ihres Hosting-Anbieters.
          </p>

          <h3 className="legal-subheading" id="kurse-heading">
            Kursinformationen und Drittanbieter
          </h3>
          <p>
            Die dargestellten Kursdaten stammen aus öffentlich zugänglichen
            Quellen und werden technisch aufbereitet. Es werden personenbezogene
            Daten von Besucherinnen und Besuchern dieser Website nicht zwecks
            Werbung verkauft oder an Dritte zu Werbezwecken weitergegeben.
            Soweit Sie externe Websites (z.&nbsp;B. Anbieter von Kursen) über Links
            besuchen, gelten dort die Datenschutzhinweise des jeweiligen Betreibers.
          </p>

          <h3 className="legal-subheading" id="rechte-heading">
            Ihre Rechte
          </h3>
          <p>Sie haben — soweit die gesetzlichen Voraussetzungen erfüllt sind — insbesondere:</p>
          <ul className="legal-list">
            <li>
              das Recht auf Auskunft über die Sie betreffenden gespeicherten
              Daten (Art. 15 DSGVO),
            </li>
            <li>das Recht auf Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
            <li>das Recht auf Löschung (Art. 17 DSGVO),</li>
            <li>
              das Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO),
            </li>
            <li>
              das Recht auf Datenübertragbarkeit (Art. 20 DSGVO),
            </li>
            <li>
              das Recht, einer auf Art. 6 Abs. 1 lit. e oder f DSGVO beruhenden
              Verarbeitung zu widersprechen (Art. 21 DSGVO),
            </li>
            <li>
              das Recht, eine erteilte Einwilligung jederzeit mit Wirkung für die
              Zukunft zu widerrufen (Art. 7 Abs. 3 DSGVO).
            </li>
          </ul>
          <p>
            Darüber hinaus haben Sie das Recht, sich bei einer
            Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO),
            insbesondere beim Landesdatenschutzbeauftragten des Bundeslandes,
            in dem Sie wohnen, arbeiten oder von dem aus die mutmaßliche
            Verletzung stammt.
          </p>

          <h3 className="legal-subheading" id="beschwerde-heading">
            Beschwerderecht
          </h3>
          <p>
            Ungeachtet eines anderweitigen verwaltungsrechtlichen oder
            gerichtlichen Rechtsbehelfs steht Ihnen das Recht auf Beschwerde bei
            einer Aufsichtsbehörde zu, wenn Sie der Ansicht sind, dass die
            Verarbeitung der Sie betreffenden personenbezogenen Daten gegen die
            DSGVO verstößt.
          </p>
        </section>

        <p className="legal-back-wrap">
          <Link href="/" className="legal-back">
            ← Zurück zum Studienplaner
          </Link>
        </p>
      </article>
    </main>
  );
}
