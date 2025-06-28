// src/app/api/auth/set-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/utils/supabase/server";

//for postman api testing only

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: "access_token and refresh_token are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    // Set the session using the provided tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to set session", details: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        message: "Session set successfully",
        user: data.user,
        session: data.session
      },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON or server error" },
      { status: 400 }
    );
  }
}