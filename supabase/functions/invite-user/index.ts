import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const siteUrl = Deno.env.get('SITE_URL') ?? ''

    // Admin client — uses service_role key, bypasses RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify the caller is an authenticated admin or manager
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: callerUser }, error: callerError } = await supabaseClient.auth.getUser()
    if (callerError || !callerUser) {
      throw new Error('Unauthorized')
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (profileError || !callerProfile || !['admin', 'manager'].includes(callerProfile.role)) {
      throw new Error('Forbidden: requires admin or manager role')
    }

    // Parse request body
    const {
      action,
      email,
      full_name,
      role,
      access_level,
      client_id,
      location_id,
      redirectTo,
    } = await req.json()

    if (!action || !email) {
      throw new Error('Missing required fields: action, email')
    }

    const inviteRedirectTo = redirectTo || siteUrl || 'https://app.ayau.com'

    if (action === 'invite') {
      // Create user via invitation — sends email with "Set your password" link
      const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: full_name || '',
            role: role || 'user',
          },
          redirectTo: inviteRedirectTo,
        }
      )

      if (inviteError) throw inviteError

      // Wait for the handle_new_user() trigger to create the profile row
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Update the profile with access level and account/location assignment
      const profileUpdates: Record<string, unknown> = {}

      if (access_level) {
        profileUpdates.access_level = access_level
      }

      if (access_level === 'account') {
        profileUpdates.client_id = client_id || null
        profileUpdates.location_id = null
      } else if (access_level === 'location') {
        profileUpdates.location_id = location_id || null
        profileUpdates.client_id = null
      }

      if (Object.keys(profileUpdates).length > 0 && data.user) {
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', data.user.id)

        if (updateError) {
          console.error('Warning: profile update failed after invite:', updateError)
          // Don't throw — the user was invited successfully, profile update is secondary
        }
      }

      return new Response(JSON.stringify({ user: data.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'resend') {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      if (!resendApiKey) throw new Error('RESEND_API_KEY not configured')

      // Generate a recovery link via Admin API (does NOT send an email)
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: inviteRedirectTo },
      })

      if (linkError) throw linkError

      const actionLink = linkData.properties?.action_link
      if (!actionLink) throw new Error('Failed to generate invitation link')

      // Send a fully custom invitation email via Resend
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ayau <noreply@ayaumusic.com>',
          to: [email],
          subject: 'Configura tu contraseña en Ayau',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h2 style="color:#1a1a1a;margin-bottom:8px;">Bienvenido a Ayau</h2>
              <p style="color:#444;line-height:1.6;">
                Un administrador te ha invitado a la plataforma Ayau.<br/>
                Haz clic en el botón para establecer tu contraseña y acceder a tu cuenta.
              </p>
              <a href="${actionLink}"
                style="display:inline-block;margin-top:24px;padding:12px 28px;background:#F4D03F;color:#1a1a1a;font-weight:bold;text-decoration:none;border-radius:6px;">
                Establecer mi contraseña
              </a>
              <p style="color:#888;font-size:12px;margin-top:32px;">
                Este enlace expira en 24 horas. Si no esperabas este correo, puedes ignorarlo.
              </p>
            </div>
          `,
        }),
      })

      if (!emailRes.ok) {
        const emailErr = await emailRes.json()
        throw new Error(`Resend error: ${JSON.stringify(emailErr)}`)
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('invite-user function error:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
