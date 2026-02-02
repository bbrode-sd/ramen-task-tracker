import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface InviteRequest {
  email: string;
  boardId: string;
  boardName: string;
  inviterName: string;
  inviterEmail: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, boardId, boardName, inviterName, inviterEmail }: InviteRequest = await request.json();

    // Validate required fields
    if (!email || !boardId || !boardName || !inviterName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your-resend-api-key-here') {
      console.log('[Invite] No Resend API key configured, skipping email send');
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: 'Invitation created but email not sent (API key not configured)',
      });
    }

    // Build the board URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tomobodo.com';
    const boardUrl = `${baseUrl}/boards/${boardId}`;

    // Send the invitation email
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Tomobodo <noreply@tomobodo.com>',
      to: email,
      replyTo: inviterEmail,
      subject: `${inviterName} invited you to collaborate on "${boardName}"`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Board Invitation</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">You're Invited!</h1>
            </div>
            
            <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <p style="margin: 0 0 16px 0; font-size: 16px;">
                <strong>${inviterName}</strong> has invited you to collaborate on a board in Tomobodo:
              </p>
              
              <div style="background: white; border-radius: 8px; padding: 16px; border-left: 4px solid #f97316;">
                <h2 style="margin: 0; color: #1f2937; font-size: 20px;">${boardName}</h2>
              </div>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${boardUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Board
              </a>
            </div>
            
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Note:</strong> You'll need to sign in or create an account to access this board. Once you sign in with this email address (${email}), you'll automatically have access.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              This invitation was sent by ${inviterName}${inviterEmail ? ` (${inviterEmail})` : ''}.<br>
              If you weren't expecting this email, you can safely ignore it.
            </p>
          </body>
        </html>
      `,
      text: `
${inviterName} invited you to collaborate on "${boardName}"

You've been invited to join a board on Tomobodo!

View the board: ${boardUrl}

Note: You'll need to sign in or create an account to access this board. Once you sign in with this email address (${email}), you'll automatically have access.

This invitation was sent by ${inviterName}${inviterEmail ? ` (${inviterEmail})` : ''}.
If you weren't expecting this email, you can safely ignore it.
      `.trim(),
    });

    if (error) {
      console.error('[Invite] Failed to send email:', error);
      return NextResponse.json(
        { error: 'Failed to send invitation email', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Invite] Email sent successfully:', data?.id);

    return NextResponse.json({
      success: true,
      emailSent: true,
      messageId: data?.id,
    });
  } catch (error) {
    console.error('[Invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process invitation' },
      { status: 500 }
    );
  }
}
