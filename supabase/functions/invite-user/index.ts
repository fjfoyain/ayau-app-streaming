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
      // Resend the invitation — Supabase will resend if user exists and hasn't confirmed
      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteRedirectTo,
      })

      if (resendError) throw resendError

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
