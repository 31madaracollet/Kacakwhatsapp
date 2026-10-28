/**
 * Hüküm ve Koşullar metni (tek kaynak).
 *
 * Metin değişince `TERMS_VERSION` da değişmeli: sürüm değişince herkes
 * yeniden onaylamak zorunda kalır (profiles.sozlesme_surumu ile karşılaştırılır).
 */
export const TERMS_VERSION = '2026-10-28'
export const TERMS_UPDATED = '28 Ekim 2026'

/** Mesajların kaç gün saklandığı — arayüzde bilgi olarak gösterilir. */
export const MESSAGE_RETENTION_DAYS = 3
/** Durumların kaç saat görünür kaldığı. */
export const STATUS_RETENTION_HOURS = 24

export interface TermsSection {
  title: string
  items: string[]
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Taraflar ve kapsam',
    items: [
      'Bu hüküm ve koşullar, ZapMesaj (zapmesaj.vercel.app) üzerinden sunulan mesajlaşma, durum paylaşımı, dosya paylaşımı ve sesli/görüntülü arama hizmetlerinin kullanımına ilişkin kuralları belirler.',
      'Hesap oluşturduğunda veya giriş yaptığında bu metnin tamamını okuduğunu ve kabul ettiğini beyan etmiş olursun. Kabul etmiyorsan hizmeti kullanmamalısın.',
    ],
  },
  {
    title: '2. Hesap oluşturma ve güvenlik',
    items: [
      'Hesap açarken verdiğin bilgilerin doğru olması gerekir. Doğum tarihi, ad soyad ve kullanıcı adı bilgilerini gerçeğe uygun gir.',
      'Şifrenin gizliliği sana aittir. Şifreni başkalarıyla paylaşma; hesabında yetkisiz bir işlem fark edersen derhal şifreni değiştir.',
      'Bir başkasının adına, taklit amacıyla veya yanıltıcı kullanıcı adlarıyla hesap açamazsın.',
      'Yönetici, kuralları ihlal eden hesapları uyarabilir, kısıtlayabilir veya kapatabilir.',
    ],
  },
  {
    title: '3. Kabul edilebilir kullanım',
    items: [
      'Hizmeti yalnızca yasal amaçlarla kullanabilirsin. Şu davranışlar yasaktır: tehdit, hakaret, taciz, nefret söylemi, kişisel verilerin rızasız paylaşımı, yasa dışı içerik, spam, dolandırıcılık.',
      'Başkalarının izni olmadan özel fotoğraf, video veya yazışma paylaşma. Reşit olmayan kişilere ait uygunsuz içerik yüklemek kesinlikle yasaktır ve tespit edildiğinde hesap kapatılır.',
      'Hizmeti aşırı yükleyecek, otomatik veri çekecek (scraping), zafiyet arayacak veya başkalarının kullanımını engelleyecek şekilde kullanamazsın.',
      'Yüklediğin içerikten doğrudan sen sorumlusun.',
    ],
  },
  {
    title: '4. Mesajların saklanma süresi ve silme',
    items: [
      `Mesajlar gönderildikten sonra en fazla ${MESSAGE_RETENTION_DAYS} gün saklanır. Süresi dolan mesajlar ve bunlara ait fotoğraf, video, ses kaydı ve dosyalar sunucudan otomatik olarak kalıcı biçimde silinir; silinen mesajlar geri getirilemez.`,
      `24 saatlik durumlar (status) ${STATUS_RETENTION_HOURS} saat sonra görünmez olur ve dosyalarıyla birlikte sunucudan temizlenir.`,
      'Kendi gönderdiğin bir mesajı uygulama içinden sildiğinde, mesaj ve varsa dosyası depodan da silinir.',
      'Bu saklama süresi bir arşiv hizmeti değildir: önemli bilgileri ayrıca kendin yedeklemelisin.',
    ],
  },
  {
    title: '5. İçerik ve telif',
    items: [
      'Paylaştığın içeriğin telif hakları sana aittir. Hizmeti çalıştırabilmek için (yükleme, iletme, görüntüleme, saklama) bu içeriği yalnızca hizmetin gerektirdiği ölçüde işlememize izin vermiş olursun.',
      'Başkasına ait telifli eserleri izinsiz paylaşma. Hak sahibinin şikâyeti üzerine ilgili içerik kaldırılabilir.',
    ],
  },
  {
    title: '6. Gizlilik ve veri işleme',
    items: [
      'Hesap bilgileri (ad, kullanıcı adı, e-posta, profil fotoğrafı) ve mesajlar Supabase altyapısında, medya dosyaları ise yapılandırılmış depolama sağlayıcısında saklanır.',
      'Mesajlar yalnızca ilgili sohbetin üyeleri tarafından okunabilir; bu erişim veritabanı seviyesinde satır güvenliği (RLS) ile sınırlandırılır.',
      'Sesli ve görüntülü aramalar tarayıcılar arasında WebRTC ile kurulur; arama içeriği kaydedilmez.',
      'Rızan dışında üçüncü taraflara veri satmayız, reklam amacıyla profilleme yapmayız.',
      'Hesabını silmek istediğinde talebin üzerine profil bilgilerin, mesajların ve dosyaların silinir; teknik yedeklerde en fazla 30 gün kalabilir.',
    ],
  },
  {
    title: '7. Hizmetin sürekliliği',
    items: [
      'Hizmet "olduğu gibi" sunulur. Kesintisiz veya hatasız çalışacağına dair garanti verilmez; bakım, güncelleme veya altyapı sağlayıcısı kaynaklı kesintiler olabilir.',
      'Hizmetin bir bölümü önceden bildirim yapılarak değiştirilebilir veya kaldırılabilir.',
    ],
  },
  {
    title: '8. Sorumluluğun sınırı',
    items: [
      'Kullanıcılar arasında geçen konuşmaların içeriğinden kullanıcılar sorumludur. Hizmet sağlayıcısı, kullanıcı içeriğinden doğan zararlardan sorumlu tutulamaz.',
      'Veri kaybı, kesinti veya üçüncü kişi erişimi hâllerinde dolaylı zararlar için sorumluluk kabul edilmez. Uygulanabilir hukukun izin verdiği azami ölçüde sorumluluk sınırlıdır.',
    ],
  },
  {
    title: '9. Değişiklikler ve kabul',
    items: [
      'Bu koşullar güncellenebilir. Önemli bir değişiklikte metnin yeni sürümü onayına sunulur ve sen yeni sürümü kabul etmeden uygulamayı kullanamazsın.',
      'Kabul işlemi, sürüm numarası ve kabul tarihiyle birlikte hesabında saklanır.',
    ],
  },
  {
    title: '10. Yürürlük',
    items: [
      `Bu metin ${TERMS_UPDATED} tarihinde yürürlüğe girmiştir.`,
      'Sorularını uygulama içindeki yönetim iletişim kanalından iletebilirsin.',
    ],
  },
]
