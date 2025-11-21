// POST /api/leads/[id]/book-meeting
// Record a meeting booking for a lead

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firestore-admin";
import { logMeetingBookedEvent } from "@/lib/analytics-helpers";
import type { Lead } from "@/lib/types";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch lead document
    const leadDoc = await adminDb.collection("leads").doc(id).get();

    if (!leadDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found",
        },
        { status: 404 }
      );
    }

    const leadData = leadDoc.data() as Lead;

    // Check if meeting already booked
    if (leadData.meeting_booked_at) {
      return NextResponse.json({
        success: true,
        message: "Meeting already booked",
        lead: {
          ...leadData,
          id: leadDoc.id,
        },
      });
    }

    // Check if email was sent
    if (leadData.status !== 'sent') {
      return NextResponse.json(
        {
          success: false,
          error: "Email has not been sent yet",
        },
        { status: 400 }
      );
    }

    // Record meeting booked timestamp
    const bookedAt = Timestamp.now();
    await adminDb.collection("leads").doc(id).update({
      meeting_booked_at: bookedAt,
    });

    // Calculate time to booking
    let sentTime: number;
    if (!leadData.closed_at) {
      sentTime = Date.now();
    } else if (typeof (leadData.closed_at as any).toDate === 'function') {
      sentTime = (leadData.closed_at as any).toDate().getTime();
    } else {
      sentTime = (leadData.closed_at as Date).getTime();
    }
    const bookedTime = bookedAt.toDate().getTime();
    const timeToBookingMs = bookedTime - sentTime;

    // Log analytics event
    const updatedLead = {
      ...leadData,
      id: leadDoc.id,
      meeting_booked_at: bookedAt,
    };
    await logMeetingBookedEvent(updatedLead as Lead, timeToBookingMs);

    // Fetch updated lead
    const updatedDoc = await adminDb.collection("leads").doc(id).get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      message: "Meeting booked successfully",
      lead: {
        id: updatedDoc.id,
        ...updatedData,
      },
      time_to_booking_ms: timeToBookingMs,
    });
  } catch (error) {
    console.error("Error booking meeting:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to book meeting",
      },
      { status: 500 }
    );
  }
}
