#!/usr/bin/env node
import { getWpConfig, wpAuthHeader } from './lib/env.mjs';

async function main() {
  const { baseUrl, username, appPassword } = getWpConfig();

  if (!username || !appPassword) {
    console.log('SONUÇ: BAŞARISIZ — WordPress kimlik bilgileri eksik (.env)');
    process.exit(1);
  }

  const url = `${baseUrl}/wp-json/wp/v2/users/me`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: wpAuthHeader(username, appPassword),
      },
    });

    if (res.ok) {
      const user = await res.json();
      console.log('SONUÇ: BAŞARILI');
      console.log(`Endpoint: ${baseUrl}/wp-json/wp/v2/users/me`);
      console.log(`Kullanıcı ID: ${user.id}`);
      console.log(`Görünen ad: ${user.name || '(yok)'}`);
      process.exit(0);
    }

    console.log('SONUÇ: BAŞARISIZ');
    console.log(`HTTP durum kodu: ${res.status}`);
    if (res.status === 401) {
      console.log('Not: Kimlik doğrulama reddedildi. .env içindeki kullanıcı adı ve Application Password alanlarının doğru eşleştiğini kontrol edin.');
    }
    process.exit(1);
  } catch (err) {
    console.log('SONUÇ: BAŞARISIZ');
    console.log(`Bağlantı hatası: ${err.message}`);
    process.exit(1);
  }
}

main();
