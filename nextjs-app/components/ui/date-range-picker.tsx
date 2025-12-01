"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { format, set } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateRangePickerProps {
  date?: DateRange
  onDateChange?: (date: DateRange | undefined) => void
  className?: string
  showTimezone?: boolean
  maxDate?: Date
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  showTimezone = true,
  maxDate,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [timezone, setTimezone] = React.useState("America/Los_Angeles")

  // Internal state for the picker (before apply)
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(date)
  const [startDateStr, setStartDateStr] = React.useState("")
  const [startTimeStr, setStartTimeStr] = React.useState("12:00 AM")
  const [endDateStr, setEndDateStr] = React.useState("")
  const [endTimeStr, setEndTimeStr] = React.useState("11:59 PM")

  // Sync internal state when date prop changes or popover opens
  React.useEffect(() => {
    if (date) {
      setInternalRange(date)
      if (date.from) {
        setStartDateStr(format(date.from, "MMM dd, yyyy"))
        setStartTimeStr(format(date.from, "h:mm a"))
      }
      if (date.to) {
        setEndDateStr(format(date.to, "MMM dd, yyyy"))
        setEndTimeStr(format(date.to, "h:mm a"))
      }
    }
  }, [date, open])

  const parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return null
    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const period = match[3].toUpperCase()

    if (period === "PM" && hours !== 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0

    return { hours, minutes }
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setInternalRange(range)
    if (range?.from) {
      setStartDateStr(format(range.from, "MMM dd, yyyy"))
    }
    if (range?.to) {
      setEndDateStr(format(range.to, "MMM dd, yyyy"))
    }
  }

  const handleApply = () => {
    let from = internalRange?.from
    let to = internalRange?.to

    // Apply time to dates
    if (from) {
      const startTime = parseTime(startTimeStr)
      if (startTime) {
        from = set(from, { hours: startTime.hours, minutes: startTime.minutes, seconds: 0 })
      }
    }
    if (to) {
      const endTime = parseTime(endTimeStr)
      if (endTime) {
        to = set(to, { hours: endTime.hours, minutes: endTime.minutes, seconds: 59 })
      }
    }

    onDateChange?.({ from, to })
    setOpen(false)
  }

  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Select Date Range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            {/* Single Month Calendar */}
            <Calendar
              mode="range"
              defaultMonth={internalRange?.from || new Date()}
              selected={internalRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              disabled={maxDate ? { after: maxDate } : undefined}
            />

            {/* Start Date/Time */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#666]">Start</Label>
              <div className="flex gap-2">
                <Input
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  placeholder="Nov 30, 2025"
                  className="h-8 text-sm"
                />
                <Input
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  placeholder="12:00 AM"
                  className="h-8 w-24 text-sm"
                />
              </div>
            </div>

            {/* End Date/Time */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#666]">End</Label>
              <div className="flex gap-2">
                <Input
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  placeholder="Nov 30, 2025"
                  className="h-8 text-sm"
                />
                <Input
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  placeholder="11:59 PM"
                  className="h-8 w-24 text-sm"
                />
              </div>
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApply}
              variant="outline"
              className="w-full h-8 text-[#888] hover:text-foreground border-[#333] hover:border-[#444] hover:bg-transparent"
            >
              Apply <span className="ml-2 text-xs text-[#666]">↵</span>
            </Button>

            {/* Timezone Selector */}
            {showTimezone && (
              <div className="flex justify-center">
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-7 w-auto border-0 bg-transparent text-xs text-[#666] hover:text-[#888]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value={localTimezone}>
                      Local ({localTimezone})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
