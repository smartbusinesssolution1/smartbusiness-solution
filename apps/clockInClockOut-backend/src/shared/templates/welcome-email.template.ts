import { emailAssets } from "./welcome-email.assets.js";

export interface RenderWelcomeEmailOptions {
  to: string;
  employeeName: string;
  employeeCode: string;
  temporaryPassword: string;
  loginUrl: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
}

export function renderWelcomeEmail(options: RenderWelcomeEmailOptions) {
  const {
    to,
    employeeCode,
    temporaryPassword,
    loginUrl,
    playStoreUrl = "#",
    appStoreUrl = "#",
  } = options;

  const subject = `Your Login Credentials`;

  // Microsoft native Segoe UI / Arial font stack
  const font = `'Segoe UI', Arial, Helvetica, sans-serif`;

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, p, a, div, span {
      font-family: 'Segoe UI', Arial, sans-serif !important;
    }
  </style>
  <![endif]-->

  <style type="text/css">
    body, table, td, h1, p, a, div, span {
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ebf3fb !important;
      -webkit-font-smoothing: antialiased !important;
    }
    table {
      border-collapse: separate !important;
    }
    img {
      border: 0 !important;
      outline: none !important;
      text-decoration: none !important;
      -ms-interpolation-mode: bicubic;
    }
    @media only screen and (max-width: 620px) {
      .card-wrap {
        padding: 24px 16px !important;
        border-radius: 18px !important;
      }
      .main-title {
        font-size: 26px !important;
      }
      .logo-title {
        font-size: 16px !important;
      }
      .logo-sub {
        font-size: 13px !important;
      }
      .app-button {
        display: block !important;
        margin: 6px auto !important;
      }
    }
  </style>
</head>
<body bgcolor="#ebf3fb" style="margin: 0; padding: 0; background-color: #ebf3fb; font-family: ${font}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

  <!-- Background Wrapper -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#ebf3fb" style="width: 100%; background-color: #ebf3fb !important; margin: 0; padding: 36px 12px; font-family: ${font};">
    <tr>
      <td align="center" bgcolor="#ebf3fb" style="background-color: #ebf3fb !important; font-family: ${font};">
        
        <!-- Center Main White Card -->
        <table width="640" class="card-wrap" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width: 640px; width: 100%; background-color: #ffffff !important; border-radius: 26px; border: 1px solid #d2e4f7; box-shadow: 0 12px 40px rgba(37,99,235,0.08); overflow: hidden; margin: 0 auto; font-family: ${font};">
          <tr>
            <td bgcolor="#ffffff" style="padding: 38px 44px 44px 44px; background-color: #ffffff !important; font-family: ${font};">
              
              <!-- Header Row: Both Logos -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                <tr>
                  <!-- Left: SmartBusiness Solutions -->
                  <td align="left" valign="middle" style="font-family: ${font}; text-align: left;">
                    <table border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                      <tr>
                        <td valign="middle" style="width: 44px; font-family: ${font};">
                          <img src="cid:smart-logo@smartbusiness.com" width="44" height="44" border="0" alt="" style="display: block; border-radius: 10px; border: 0; width: 44px; height: 44px;" />
                        </td>
                        <td valign="middle" style="padding-left: 10px; font-family: ${font}; text-align: left;">
                          <div class="logo-title" style="font-family: ${font}; font-size: 18px; font-weight: 800; color: #000000; line-height: 1.15; letter-spacing: -0.3px;">SmartBusiness</div>
                          <div class="logo-sub" style="font-family: ${font}; font-size: 15px; font-weight: 700; color: #4338ca; line-height: 1.15;">Solutions</div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Clock In Clock Out -->
                  <td align="right" valign="middle" style="font-family: ${font}; text-align: right;">
                    <table border="0" cellspacing="0" cellpadding="0" style="margin-left: auto; font-family: ${font};">
                      <tr>
                        <td valign="middle" style="width: 44px; font-family: ${font};">
                          <img src="cid:clockin-logo@smartbusiness.com" width="44" height="44" border="0" alt="" style="display: block; border-radius: 10px; border: 0; width: 44px; height: 44px;" />
                        </td>
                        <td valign="middle" style="padding-left: 10px; font-family: ${font}; text-align: left;">
                          <div class="logo-title" style="font-family: ${font}; font-size: 18px; font-weight: 800; color: #000000; line-height: 1.15; letter-spacing: -0.3px;">Clock In</div>
                          <div class="logo-sub" style="font-family: ${font}; font-size: 15px; font-weight: 700; color: #6366f1; line-height: 1.15;">Clock Out</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Main Title & Subtitle -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 42px; font-family: ${font};">
                <tr>
                  <td align="center" style="font-family: ${font}; text-align: center;">
                    <h1 class="main-title" style="margin: 0; font-family: ${font}; font-size: 34px; font-weight: 800; color: #000000; letter-spacing: -0.8px; line-height: 1.2;">
                      Your Login <span style="color: #0066ff;">Credentials</span>
                    </h1>
                    <p style="margin: 12px auto 34px auto; font-family: ${font}; font-size: 14px; color: #556476; line-height: 1.6; max-width: 460px; font-weight: 400;">
                      Your account has been successfully created. Please find your login credentials below to access your account.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Credential Input Cards (Light Blue Pill Boxes) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                
                <!-- Row 1: Username -->
                <tr>
                  <td style="padding-bottom: 12px; font-family: ${font};">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#edf5fd" style="background-color: #edf5fd !important; border-radius: 12px; border: 1px solid #d9eaf9; padding: 12px 18px; font-family: ${font};">
                      <tr>
                        <td width="34" valign="middle" bgcolor="#edf5fd" style="width: 34px; background-color: #edf5fd !important; font-family: ${font};">
                          <img src="cid:user-icon@smartbusiness.com" width="34" height="34" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 34px; height: 34px;" />
                        </td>
                        <td width="120" valign="middle" bgcolor="#edf5fd" style="width: 120px; background-color: #edf5fd !important; padding-left: 14px; font-family: ${font}; font-size: 14px; font-weight: 700; color: #0f172a;">
                          Username
                        </td>
                        <td valign="middle" bgcolor="#edf5fd" style="background-color: #edf5fd !important; font-family: ${font}; font-size: 14px; color: #0f172a; font-weight: 500;">
                          ${to}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Row 2: Password -->
                <tr>
                  <td style="padding-bottom: 12px; font-family: ${font};">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#edf5fd" style="background-color: #edf5fd !important; border-radius: 12px; border: 1px solid #d9eaf9; padding: 12px 18px; font-family: ${font};">
                      <tr>
                        <td width="34" valign="middle" bgcolor="#edf5fd" style="width: 34px; background-color: #edf5fd !important; font-family: ${font};">
                          <img src="cid:lock-icon@smartbusiness.com" width="34" height="34" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 34px; height: 34px;" />
                        </td>
                        <td width="120" valign="middle" bgcolor="#edf5fd" style="width: 120px; background-color: #edf5fd !important; padding-left: 14px; font-family: ${font}; font-size: 14px; font-weight: 700; color: #0f172a;">
                          Password
                        </td>
                        <td valign="middle" bgcolor="#edf5fd" style="background-color: #edf5fd !important; font-family: ${font}; font-size: 14px; color: #0f172a; font-weight: 500;">
                          ${temporaryPassword}
                        </td>
                        <td width="26" align="right" valign="middle" bgcolor="#edf5fd" style="width: 26px; background-color: #edf5fd !important; font-family: ${font}; text-align: right;">
                          <img src="cid:eye-icon@smartbusiness.com" width="18" height="18" border="0" alt="" style="display: block; opacity: 0.6; border: 0; width: 18px; height: 18px;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Row 3: Login URL -->
                <tr>
                  <td style="padding-bottom: 34px; font-family: ${font};">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#edf5fd" style="background-color: #edf5fd !important; border-radius: 12px; border: 1px solid #d9eaf9; padding: 12px 18px; font-family: ${font};">
                      <tr>
                        <td width="34" valign="middle" bgcolor="#edf5fd" style="width: 34px; background-color: #edf5fd !important; font-family: ${font};">
                          <img src="cid:link-icon@smartbusiness.com" width="34" height="34" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 34px; height: 34px;" />
                        </td>
                        <td width="120" valign="middle" bgcolor="#edf5fd" style="width: 120px; background-color: #edf5fd !important; padding-left: 14px; font-family: ${font}; font-size: 14px; font-weight: 700; color: #0f172a;">
                          Login URL
                        </td>
                        <td valign="middle" bgcolor="#edf5fd" style="background-color: #edf5fd !important; font-family: ${font};">
                          <a href="${loginUrl}" target="_blank" style="font-family: ${font}; font-size: 14px; color: #0066ff; text-decoration: none; font-weight: 500;">
                            ${loginUrl}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Download Mobile App Section -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family: ${font};">
                <tr>
                  <td align="center" style="padding-bottom: 14px; font-family: ${font}; text-align: center;">
                    <div style="font-family: ${font}; font-size: 11px; font-weight: 800; color: #556476; letter-spacing: 0.8px; text-transform: uppercase;">
                      DOWNLOAD THESE MOBILE APP
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: ${font}; text-align: center;">
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; font-family: ${font};">
                      <tr>
                        <td style="padding: 0 6px;">
                          <a href="${playStoreUrl}" class="app-button" style="text-decoration: none; display: inline-block;">
                            <img src="cid:google-play@smartbusiness.com" width="148" height="44" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 148px; height: 44px;" />
                          </a>
                        </td>
                        <td style="padding: 0 6px;">
                          <a href="${appStoreUrl}" class="app-button" style="text-decoration: none; display: inline-block;">
                            <img src="cid:app-store@smartbusiness.com" width="148" height="44" border="0" alt="" style="display: block; border-radius: 8px; border: 0; width: 148px; height: 44px;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Your Login Credentials

Your account has been successfully created. Please find your login credentials below:

- Username: ${to}
- Password: ${temporaryPassword}
- Login URL: ${loginUrl}
- Employee Code: ${employeeCode}

Download our mobile app on Google Play or App Store.
  `.trim();

  const attachments = [
    {
      filename: "smart-thumb.png",
      content: emailAssets.smartLogo,
      cid: "smart-logo@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "icon-thumb.png",
      content: emailAssets.clockinLogo,
      cid: "clockin-logo@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "user-icon.png",
      content: emailAssets.userIcon,
      cid: "user-icon@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "lock-icon.png",
      content: emailAssets.lockIcon,
      cid: "lock-icon@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "link-icon.png",
      content: emailAssets.linkIcon,
      cid: "link-icon@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "eye-icon.png",
      content: emailAssets.eyeIcon,
      cid: "eye-icon@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "google-play.png",
      content: emailAssets.googlePlay,
      cid: "google-play@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
    {
      filename: "app-store.png",
      content: emailAssets.appStore,
      cid: "app-store@smartbusiness.com",
      contentType: "image/png",
      contentDisposition: "inline" as const,
    },
  ];

  return { subject, html, text, attachments };
}
