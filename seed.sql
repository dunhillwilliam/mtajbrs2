-- Seed data for MTA Jebres 2 Presensi (Cloudflare D1 / SQLite)
-- IDs are generated at insert time; groups/members reference parents by name.
-- Apply with:
--   wrangler d1 execute mta-presensi --remote --file=./seed.sql

-- Batches (gelombang)
INSERT INTO batches (id, name, description) VALUES
  (lower(hex(randomblob(16))), 'Gelombang 1', 'Gelombang pertama'),
  (lower(hex(randomblob(16))), 'Gelombang 2', 'Gelombang kedua');

-- Groups
INSERT INTO groups (id, name, description, batch_id) VALUES
  (lower(hex(randomblob(16))), 'pa-kelompok1', 'Kelompok 1', (SELECT id FROM batches WHERE name = 'Gelombang 1')),
  (lower(hex(randomblob(16))), 'pa-kelompok2', 'Kelompok 2', (SELECT id FROM batches WHERE name = 'Gelombang 1')),
  (lower(hex(randomblob(16))), 'pa-kelompok3', 'Kelompok 3', (SELECT id FROM batches WHERE name = 'Gelombang 1')),
  (lower(hex(randomblob(16))), 'pa', 'Pemuda', (SELECT id FROM batches WHERE name = 'Gelombang 2')),
  (lower(hex(randomblob(16))), 'pa-ponpes', 'Pondok Pesantren', (SELECT id FROM batches WHERE name = 'Gelombang 2')),
  (lower(hex(randomblob(16))), 'pa-smamta', 'SMAMTA', (SELECT id FROM batches WHERE name = 'Gelombang 2')),
  (lower(hex(randomblob(16))), 'pemudi', 'Pemudi', (SELECT id FROM batches WHERE name = 'Gelombang 2'));

-- Members: pa-kelompok1
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Abid Sholeh Udin, A.Md.Pt.', (SELECT id FROM groups WHERE name = 'pa-kelompok1')),
  (lower(hex(randomblob(16))), 'Azzam Al Zahrani', (SELECT id FROM groups WHERE name = 'pa-kelompok1')),
  (lower(hex(randomblob(16))), 'Hand Sabili Nur Yasfin', (SELECT id FROM groups WHERE name = 'pa-kelompok1')),
  (lower(hex(randomblob(16))), 'Regan Mahesa Putra', (SELECT id FROM groups WHERE name = 'pa-kelompok1')),
  (lower(hex(randomblob(16))), 'Rio Saputro', (SELECT id FROM groups WHERE name = 'pa-kelompok1')),
  (lower(hex(randomblob(16))), 'Rozzan Miftahul Irsyad', (SELECT id FROM groups WHERE name = 'pa-kelompok1'));

-- Members: pa-kelompok2
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Bakhtiar Ahmad, S.Sn.', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Dunhill William, S.Si., CEH', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Fajar Nur Hidayat', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Hafid Al Afif, S.Pd.Gr.', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Hasan Basri, S.Kep.Ners.', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Hasim Mustofa', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Irvan Maulana, S.Pd.Gr.', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Lutfi Saifudin, S.Sos.', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Mukti Muhtadi', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Nasirudin', (SELECT id FROM groups WHERE name = 'pa-kelompok2')),
  (lower(hex(randomblob(16))), 'Ridwan Zainal Abidin', (SELECT id FROM groups WHERE name = 'pa-kelompok2'));

-- Members: pa-kelompok3
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Abdullah Anggana', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Fadil', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Fajar Eko Susilo, S.P.', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Fatir', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Jarir Abdulloh', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Muhammad Abdulloh, MMC', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Syahril', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Wahid Ariffudin, S.Pd.Gr., MMC', (SELECT id FROM groups WHERE name = 'pa-kelompok3')),
  (lower(hex(randomblob(16))), 'Zulfan Ramadlan', (SELECT id FROM groups WHERE name = 'pa-kelompok3'));

-- Members: pa (Pemuda)
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Agung', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Bagus Komputer', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Bekti Nur Huda', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Fauzan Adhima, Lc.', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Muhammad Farkhan Abadan', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Muhammad Rezky Syahputra', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Nofal Mita Hulhaq', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Paryanto', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Saiful Setyo', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Simon Santoso', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Tarmo', (SELECT id FROM groups WHERE name = 'pa')),
  (lower(hex(randomblob(16))), 'Zaki', (SELECT id FROM groups WHERE name = 'pa'));

-- Members: pa-ponpes
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Akbar', (SELECT id FROM groups WHERE name = 'pa-ponpes'));

-- Members: pa-smamta
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Santoso', (SELECT id FROM groups WHERE name = 'pa-smamta')),
  (lower(hex(randomblob(16))), 'Wildan', (SELECT id FROM groups WHERE name = 'pa-smamta'));

-- Members: pemudi
INSERT INTO members (id, nickname, group_id) VALUES
  (lower(hex(randomblob(16))), 'Afrilia vita', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Agisya', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Alifia', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Alya', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Ana', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Ana nasirrudin', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Anik Prihatiningsih', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Arin', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Atik', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Azhar Mufidah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Bela', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Bulan Apriana', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Dea', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Dewi Hariyani', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Dian Safitri', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Eni', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Esa', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Fadillah Hasna Syafitri', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Faradilla', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Fatimah Nur Jannah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Fitria Ummi Afifah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Giska', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Habibah Putri S', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Jamil', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Kayla', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'khalisha aisyah rhoyhani', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Khoirul Istiqomah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Khusnul Khotimah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Martini', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Mukarrommah Khoirun Nisaa''', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Naila', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Najwa', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Nazala', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Nikmatun Hasanah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Novita', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Nuur Ummi Khoiriyah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Rahma', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Rina Widiastuti', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Runi', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Salsabila Hii Khoir', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Salwa', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Suci Asri Sajdah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Sulastri', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Sun Ariyani', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Syahila', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Ummi Nuur Hidayah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Ummu Habibah', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Wahyuni', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Yuyun', (SELECT id FROM groups WHERE name = 'pemudi')),
  (lower(hex(randomblob(16))), 'Zain Qoniah', (SELECT id FROM groups WHERE name = 'pemudi'));
