import { wpFetch } from "./lib/wp-fetch.mjs";
import fs from "fs";

async function run() {
  console.log("=== APPLYING ADANABOSANMAAVUKATI.ORG ENTITY FIXES ===\n");

  // 1. Post 26 Author Fix (CEREN SÜMER ID 2 -> Avukat Ceren Sümer Cilli ID 1)
  console.log("1. Updating Post 26 author to Avukat Ceren Sümer Cilli (ID 1)...");
  const p26Res = await wpFetch("/wp-json/wp/v2/posts/26", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author: 1 }),
  });
  const p26Data = await p26Res.json();
  console.log("   ✓ Post 26 author updated:", p26Data.author === 1 ? "SUCCESS" : "CHECK");

  // 2. User 1 Website URL Fix -> Canonical Profile URL
  console.log("2. Updating User 1 website URL to canonical profile URL...");
  const u1Res = await wpFetch("/wp-json/wp/v2/users/1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://www.cerensumer.av.tr/av-ceren-sumer-cilli/" }),
  });
  const u1Data = await u1Res.json();
  console.log("   ✓ User 1 URL updated:", u1Data.url);

  // 3. Page 15 (avukat-ceren-sumer-cilli) Entity Cleanup & Schema Standardization
  console.log("3. Updating Page 15 conflicting claims, address and embedded schema...");
  const p15Fetch = await wpFetch("/wp-json/wp/v2/pages/15?context=edit");
  const p15 = await p15Fetch.json();
  let content = p15.content.raw || p15.content.rendered;

  // Replace conflicting claim in prose
  const oldClaim = "Avukat Ceren Sümer Cilli, 300’den fazla anlaşmalı ve çekişmeli boşanma davasında edindiği mesleki deneyimle, her dosyanın kendine özgü koşullarını dikkate alarak hukuki değerlendirmeler yapmaktadır. 2022 yılında yılın boşanma avukatı seçilmiş olması da, özellikle Adana’da boşanma ve aile hukuku alanındaki mesleki görünürlüğünü destekleyen önemli unsurlardan biridir.";
  const newClaim = "Avukat Ceren Sümer Cilli, mesleki çalışmalarını özellikle aile hukuku ve boşanma uyuşmazlıkları alanında yoğunlaştırmakta, her dosyanın kendine özgü koşullarını dikkate alarak hukuki değerlendirmeler yapmaktadır.";

  if (content.includes(oldClaim)) {
    content = content.replace(oldClaim, newClaim);
    console.log("   ✓ Replaced conflicting claim in Page 15");
  } else {
    // regex fallback
    content = content.replace(/Avukat Ceren Sümer Cilli,\s*300[’\x27]den fazla[\s\S]*?önemli unsurlardan biridir\./g, newClaim);
    console.log("   ✓ Replaced conflicting claim via regex in Page 15");
  }

  // Standardize address variations
  content = content.replaceAll(
    "Gazipaşa Mh, Ordu Cd. Dinçkan Apt No:7 A Blok Daire:3",
    "Gazipaşa Mah. Ordu Cad. No:7 Dinçkan Apt. A Blok Daire:3"
  );
  content = content.replaceAll(
    "Gazipaşa Mh. Ordu Cad. No:7 Dinçkan Apt. A Blok Daire:3",
    "Gazipaşa Mah. Ordu Cad. No:7 Dinçkan Apt. A Blok Daire:3"
  );

  // Parse and update embedded JSON-LD in content
  const canonicalPersonId = "https://www.cerensumer.av.tr/#ceren-sumer-cilli";
  const canonicalLegalServiceId = "https://www.cerensumer.av.tr/#sumer-hukuk";
  const canonicalProfileUrl = "https://www.cerensumer.av.tr/av-ceren-sumer-cilli/";
  const canonicalAddress = {
    "@type": "PostalAddress",
    "streetAddress": "Gazipaşa Mah. Ordu Cad. No:7 Dinçkan Apt. A Blok Daire:3",
    "postalCode": "01010",
    "addressLocality": "Seyhan",
    "addressRegion": "Adana",
    "addressCountry": "TR"
  };

  const verifiedSameAs = [
    "https://www.cerensumer.av.tr/av-ceren-sumer-cilli/",
    "https://adanabosanmaavukati.org/avukat-ceren-sumer-cilli/",
    "https://www.google.com/maps/place/Adana+Avukat+Ceren+S%C3%BCmer+Cilli+%7C+Adana+Bo%C5%9Fanma+Avukat%C4%B1/@36.9917146,35.3294433,17z/data=!3m1!4b1!4m6!3m5!1s0x15288f6f3764072f:0x51c862d3a8658c0d!8m2!3d36.9917146!4d35.3294433!16s%2Fg%2F11c209qv9m",
    "https://www.linkedin.com/in/avukat-ceren-s%C3%BCmer-cilli-375873b0/",
    "https://www.instagram.com/av.cerensumercilli/",
    "https://www.facebook.com/cerensumercilli/",
    "https://blog.milliyet.com.tr/avcerensumercilli"
  ];

  // Replace ld+json block in content
  content = content.replace(/(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/i, (full, open, jsonText, close) => {
    try {
      const data = JSON.parse(jsonText);
      const graph = data["@graph"] || (Array.isArray(data) ? data : [data]);
      for (const node of graph) {
        if (node["@type"] === "Person") {
          node["@id"] = canonicalPersonId;
          node["name"] = "Avukat Ceren Sümer Cilli";
          node["url"] = canonicalProfileUrl;
          node["worksFor"] = { "@id": canonicalLegalServiceId };
          node["address"] = canonicalAddress;
          node["sameAs"] = verifiedSameAs;
          node["knowsAbout"] = [
            "Aile Hukuku",
            "Boşanma Hukuku",
            "Çekişmeli Boşanma",
            "Anlaşmalı Boşanma",
            "Velayet",
            "Nafaka",
            "Mal Rejiminin Tasfiyesi",
            "Ziynet Alacağı",
            "Aile Konutu",
            "6284 sayılı Kanun kapsamındaki tedbirler"
          ];
        } else if (node["@type"] === "LegalService") {
          node["@id"] = canonicalLegalServiceId;
          node["name"] = "Sümer Hukuk Bürosu";
          node["legalName"] = "Sümer Hukuk Bürosu";
          node["url"] = "https://www.cerensumer.av.tr/";
          node["telephone"] = "+905336342425";
          node["address"] = canonicalAddress;
          node["founder"] = { "@id": canonicalPersonId };
          node["employee"] = { "@id": canonicalPersonId };
          node["openingHoursSpecification"] = [
            {
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              "opens": "09:00",
              "closes": "18:00"
            }
          ];
          node["sameAs"] = [
            "https://www.google.com/maps/place/Adana+Avukat+Ceren+S%C3%BCmer+Cilli+%7C+Adana+Bo%C5%9Fanma+Avukat%C4%B1/@36.9917146,35.3294433,17z/data=!3m1!4b1!4m6!3m5!1s0x15288f6f3764072f:0x51c862d3a8658c0d!8m2!3d36.9917146!4d35.3294433!16s%2Fg%2F11c209qv9m",
            "https://www.linkedin.com/in/avukat-ceren-s%C3%BCmer-cilli-375873b0/",
            "https://www.instagram.com/av.cerensumercilli/",
            "https://www.facebook.com/cerensumercilli/"
          ];
        }
      }
      return `${open}\n${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2)}\n${close}`;
    } catch (e) {
      console.error("Error parsing embedded JSON-LD in Page 15:", e);
      return full;
    }
  });

  const p15Update = await wpFetch("/wp-json/wp/v2/pages/15", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const p15UpdatedData = await p15Update.json();
  console.log("   ✓ Page 15 updated successfully, ID:", p15UpdatedData.id);

  // 4. Update Snippet 9 (Rank Math Person Deduplication to canonical entity)
  console.log("4. Updating Code Snippet 9 (Rank Math filter) with canonical Person @id...");
  const s9Fetch = await wpFetch("/wp-json/code-snippets/v1/snippets/9");
  const s9 = await s9Fetch.json();
  let s9Code = s9.code;

  // Update target ID and profile URL to canonical
  s9Code = s9Code.replace(
    /\$target_id = 'https:\/\/adanabosanmaavukati\.org\/avukat-ceren-sumer-cilli\/#person';/g,
    "$target_id = 'https://www.cerensumer.av.tr/#ceren-sumer-cilli';"
  );
  s9Code = s9Code.replace(
    /\$profile_url = 'https:\/\/adanabosanmaavukati\.org\/avukat-ceren-sumer-cilli\/';/g,
    "$profile_url = 'https://www.cerensumer.av.tr/av-ceren-sumer-cilli/';"
  );
  s9Code = s9Code.replace(
    /'@id' => 'https:\/\/adanabosanmaavukati\.org\/avukat-ceren-sumer-cilli\/#person',/g,
    "'@id' => 'https://www.cerensumer.av.tr/#ceren-sumer-cilli',",
  );
  s9Code = s9Code.replace(
    /'url' => 'https:\/\/adanabosanmaavukati\.org\/avukat-ceren-sumer-cilli\/',/g,
    "'url' => 'https://www.cerensumer.av.tr/av-ceren-sumer-cilli/',",
  );
  s9Code = s9Code.replace(
    /'worksFor' => array\(\s*'@id' => 'https:\/\/adanabosanmaavukati\.org\/#organization',\s*\),/g,
    "'worksFor' => array( '@id' => 'https://www.cerensumer.av.tr/#sumer-hukuk' ),"
  );
  s9Code = s9Code.replace(
    /'address' => array\(\s*'@type' => 'PostalAddress',\s*'addressLocality' => 'Adana',\s*'addressCountry' => 'Türkiye',\s*\),/g,
    `'address' => array(
			'@type' => 'PostalAddress',
			'streetAddress' => 'Gazipaşa Mah. Ordu Cad. No:7 Dinçkan Apt. A Blok Daire:3',
			'postalCode' => '01010',
			'addressLocality' => 'Seyhan',
			'addressRegion' => 'Adana',
			'addressCountry' => 'TR',
		),`
  );

  const s9Update = await wpFetch("/wp-json/code-snippets/v1/snippets/9", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: s9Code }),
  });
  const s9UpdatedData = await s9Update.json();
  console.log("   ✓ Snippet 9 updated successfully, active:", s9UpdatedData.active);

  console.log("\n=== ADANABOSANMAAVUKATI.ORG FIXES COMPLETED SUCCESSFULLY ===");
}

run().catch(console.error);
