import React, { forwardRef } from 'react';

const AttendanceReportPrint = forwardRef(({ data }, ref) => {
  if (!data || !data.recap) return null;

  const { period, print_date, is_single_user, recap } = data;

  return (
    <div ref={ref} style={{
      width: '100%',
      maxWidth: '210mm',
      minHeight: '297mm',
      padding: '20mm 15mm',
      background: 'white',
      color: 'black',
      fontFamily: '"Times New Roman", Times, serif',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* KOP SURAT */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '20px', borderBottom: '3px solid black', paddingBottom: '10px', minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/logo-poltek.png" alt="Logo Politeknik" style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '90px' }} />
        <div style={{ padding: '0 100px', width: '100%' }}>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>YAYASAN PENDIDIKAN BHAKTI PRAJA TEGAL</h1>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 'bold', color: '#003366' }}>POLITEKNIK BAJA TEGAL</h2>
          <h3 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 'bold' }}>TERAKREDITASI &quot;BAIK&quot; NO. 341/SK/BAN-PT/Akred/PT/VII/2022</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
            Alamat : Jl. Raya Barat Dukuhwaru, Jatibarang-Slawi Km. 7, Kab. Tegal<br/>
            Telp. (0283) 6196309 - Website : www.pbjt.ac.id - E-mail : info@pbjt.ac.id
          </p>
        </div>
        <img src="/logo-banpt.png" alt="Logo BAN-PT" style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', width: '85px' }} />
      </div>

      {/* JUDUL LAPORAN */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline' }}>
          LAPORAN REKAPITULASI KEHADIRAN
        </h2>
      </div>

      {/* INFO PERIODE */}
      <div style={{ marginBottom: '20px', fontSize: '12px' }}>
        <table style={{ border: 'none', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ width: '100px', padding: '2px 0' }}>Periode</td>
              <td style={{ width: '10px', padding: '2px 0' }}>:</td>
              <td style={{ padding: '2px 0' }}>{period}</td>
            </tr>
            {is_single_user && recap.length > 0 && (
              <>
                <tr>
                  <td style={{ padding: '2px 0' }}>Nama Pegawai</td>
                  <td style={{ padding: '2px 0' }}>:</td>
                  <td style={{ padding: '2px 0', fontWeight: 'bold' }}>{recap[0].user_name}</td>
                </tr>
                <tr>
                  <td style={{ padding: '2px 0' }}>NIY / ID</td>
                  <td style={{ padding: '2px 0' }}>:</td>
                  <td style={{ padding: '2px 0' }}>{recap[0].employee_id}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* TABEL REKAP */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '5%' }}>No</th>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left', backgroundColor: '#f9f9f9', width: '35%' }}>Nama Pegawai</th>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left', backgroundColor: '#f9f9f9', width: '25%' }}>NIY/ID</th>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '10%' }}>Hadir</th>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '10%' }}>Terlambat</th>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '7%' }}>Izin</th>
            <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '8%' }}>Alpha</th>
          </tr>
        </thead>
        <tbody>
          {recap.map((item, index) => (
            <tr key={item.user_id}>
              <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ border: '1px solid black', padding: '6px' }}>{item.user_name || '-'}</td>
              <td style={{ border: '1px solid black', padding: '6px' }}>{item.employee_id || '-'}</td>
              <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.hadir}</td>
              <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.terlambat}</td>
              <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.izin}</td>
              <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{item.alpha}</td>
            </tr>
          ))}
          {recap.length === 0 && (
            <tr>
              <td colSpan="7" style={{ border: '1px solid black', padding: '12px', textAlign: 'center' }}>Tidak ada data</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* TABEL DETAIL (JIKA SINGLE USER) */}
      {is_single_user && recap.length > 0 && recap[0].detail && recap[0].detail.length > 0 && (
        <>
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Detail Kehadiran Harian:</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f0f0f0' }}>Tanggal</th>
                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f0f0f0' }}>Jam Masuk</th>
                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f0f0f0' }}>Jam Pulang</th>
                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f0f0f0' }}>Shift</th>
                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center', backgroundColor: '#f0f0f0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recap[0].detail.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{row.date}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{row.in}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{row.out}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{row.shift}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* FOOTER TANDA TANGAN */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', fontSize: '12px', pageBreakInside: 'avoid' }}>
        <div style={{ textAlign: 'center', minWidth: '220px' }}>
          <p style={{ margin: '0 0 5px 0' }}>Dukuhwaru, {print_date}</p>
          <p style={{ margin: '0 0 70px 0' }}>Wakil Direktur Bidang Akademik dan Kepegawaian</p>
          <p style={{ margin: '0', fontWeight: 'bold', textDecoration: 'underline' }}>Aziz Azindani, M.Kom</p>
          <p style={{ margin: '0' }}>850018701</p>
        </div>
      </div>
    </div>
  );
});

export default AttendanceReportPrint;
