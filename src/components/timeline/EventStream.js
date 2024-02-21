import React from 'react'
import { Spinner, Button, Icon, Stack, StackItem } from 'nr1'
import dayjs from 'dayjs'
import startCase from 'lodash.startcase'

export default class EventStream extends React.Component {
  state = {
    expandedTimelineItem: null,
  }
      
  chooseColor(someString) {
    const ridColors = [
          '#2f4f4f',
          '#8b4513',
          '#6b8e23',
          '#000080',
          '#48d1cc',
          '#ffa500',
          '#00ff26',
          '#00ff00',
          '#00fa9a',
          '#0000ff',
          '#ff00ff',
          '#6495ed',
          '#ff1493',
          '#ffdab9',
          '#000000'
        ]
    let charTotal = 0
    for (let i = 0; i < someString.length; i++) {
      charTotal += someString.charCodeAt(i)
    }

    return ridColors[charTotal % ridColors.length]
  }

  handleTimelineItemClick = e => {
    //if it's a custom event, change the filter boundaries
    e.preventDefault()
    const { expandedTimelineItem } = this.state

    let timelineItemId = e.currentTarget.getAttribute('data-timeline-item-id')
    if (timelineItemId == expandedTimelineItem) {
      this.setState({ expandedTimelineItem: null })
    } else {
      this.setState({ expandedTimelineItem: timelineItemId })
    }
  }

  buildStreamTimeline = event => {
    let timeline = Object.keys(event)
    timeline = timeline.sort()
    let data = []

    timeline.forEach((attr, i) => {
      if (!attr.startsWith('nr.') && event[attr]) {
        data.push(
          <li key={i} className="timeline-item-contents-item">
            <span className="key">{attr}</span>
            <span className="value">{event[attr]}</span>
          </li>
        )
      }
    })
    return data
  }

  getTitleDetails = event => {
    const {
      config: { eventTitleAttributes },
    } = this.props
    var title = eventTitleAttributes.find(
      attr => attr.name === event.eventType
    )


    if (title) {
      if (event.eventAction === 'AjaxRequest') {
        return this.truncateTitle(
          `Duration: ${event.timeToLoadEventStart}, URL: ${event.requestUrl}`,
          title.truncateStart || false
        )
      } else {
        return this.truncateTitle(
          event['Name'] || event[title.primary] || event[title.secondary],
          title.truncateStart || false
        )
      }
    }
  }

  truncateTitle = (original, truncateStart) => {
    const maxLength = 400 

    let truncated = original
    if (original?.length > maxLength) {
      if (truncateStart)
        truncated = '...' + original.slice(original.length - maxLength)
      else truncated = original.slice(0, maxLength) + '...'
    }

    return truncated
  }

  buildStreamEventWarningPanel = event => {
    const conditions = event['nr.warningConditions']
    return (
      <React.Fragment>
        <div className="warning-header">
          We found the following violations for this event:
        </div>
        <ul>
          {conditions.map((c, idx) => {
            return (
              <li key={idx} className="warning-condition">
                {c.attribute} &gt; {c.threshold}
                <span className="warning-condition__actual-value ">
                  [this event: {c.actual}]
                </span>
              </li>
            )
          })}
        </ul>
      </React.Fragment>
    )
  }

  handleSetFilter = (e, event, globalMinTime, setFilterFunc) => {
    // console.log(event.eventAction)
    e.preventDefault()
    if (event.eventAction === 'Custom Interaction') {// || event.eventAction === 'MobileRequest') {
      var resultDuration;
      if (event['Time Elapsed'] > 0 ) {
        resultDuration = event['Time Elapsed']
      } else {
        resultDuration = event.duration*1000
      }
      setFilterFunc(event.timestamp - globalMinTime - 100, event.timestamp + resultDuration - globalMinTime + 100)
    }
  }

  buildStream = (data, legend, filterStartTime, filterEndTime, setFilter) => {
    const { showWarningsOnly } = this.props
    const sessionEvents = []

    var globalMinTime;
    data.forEach((event, i) => {
      if (i == 0) {
        globalMinTime = event.timestamp
      }

      const hasWarnings = event['nr.warnings']

      if (!showWarningsOnly || (showWarningsOnly && hasWarnings)) {
        let legendItem = null
        for (let item of legend) {
          if (item.group.actionNames.includes(event.eventAction)) {
            legendItem = item
            break
          }
        }
        if (!legendItem)
          legendItem = legend.find(item => item.group.name === 'GENERAL')

        const date = new Date(event.timestamp)
        const streamTimeline = this.buildStreamTimeline(event)
        let open = this.state.expandedTimelineItem == i ? 'timeline-item-expanded' : ''
        let inScope = (event.timestamp > globalMinTime + filterStartTime && event.timestamp < globalMinTime + filterEndTime)
        legendItem &&
          inScope &&
          legendItem.visible &&
          sessionEvents.push(
            <div
              key={i}
              data-timeline-item-id={i}
              onClick={this.handleTimelineItemClick}
              className={`timeline-item ${legendItem.group.eventDisplay.class} ${open}`}
            >
              <div 
                className="timeline-item-timestamp"
                onClick={(e) => this.handleSetFilter(e, event, globalMinTime, setFilter)}
              >
                <span className="timeline-timestamp-date">
                  {event.timestamp}
                  {/* {dayjs(date).format('MM/DD/YYYY')} */}
                </span>
                <span className="timeline-timestamp-time">
                  + {event.timestamp - globalMinTime}
                </span>
              </div>
              <div className="timeline-item-dot"></div>
              <div
                className={
                  hasWarnings
                    ? 'timeline-item-body warning'
                    : 'timeline-item-body'
                }
              >
                <div className="timeline-item-body-header">
                  <div className="timeline-item-symbol">
                    <Icon
                      className="timeline-item-symbol-icon"
                      type={legendItem.group.eventDisplay.icon}
                      color={legendItem.group.name === 'REQUEST' || legendItem.group.name === 'AJAX' ? this.chooseColor(event.requestUrl) : legendItem.group.eventDisplay.color }
                    ></Icon>
                  </div>
                  <div className="timeline-item-title"
                      style={
                      {color : legendItem.group.name === 'REQUEST' || legendItem.group.name === 'AJAX' ? this.chooseColor(event.requestUrl) : legendItem.group.eventDisplay.color }
                      }
                  >
                    {startCase(event.eventAction)}:{' '}
                    <span className="timeline-item-title-detail">
                      {this.getTitleDetails(event)}
                    </span>
                  </div>
                  <Button
                    className="timeline-item-dropdown-arrow"
                    type={Button.TYPE.PLAIN}
                    iconType={
                      Button.ICON_TYPE
                        .INTERFACE__CHEVRON__CHEVRON_BOTTOM__V_ALTERNATE
                    }
                  ></Button>
                </div>
                <div className="timeline-item-contents-container">
                  {hasWarnings && (
                    <div className="timeline-item-contents__warning-panel">
                      {this.buildStreamEventWarningPanel(event)}
                    </div>
                  )}
                  <ul className="timeline-item-contents">{streamTimeline}</ul>
                </div>
              </div>
            </div>
          )
      }
    })
    return sessionEvents
  }

  render() {
    const { data, loading, legend, filterStartTime, filterEndTime, setFilter} = this.props

    const stream = this.buildStream(data, legend, filterStartTime, filterEndTime, setFilter)

    const eventContent = loading ? (
      <Spinner />
    ) : !loading && stream.length > 0 ? (
      <div className="timeline-container">{stream}</div>
    ) : (
      <Stack
        fullWidth
        fullHeight
        className="emptyState eventStreamEmptyState"
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        horizontalType={Stack.HORIZONTAL_TYPE.CENTER}
        verticalType={Stack.VERTICAL_TYPE.CENTER}
      >
        <StackItem>
          <p className="emptyStateHeader">Event Stream data not available.</p>
        </StackItem>
      </Stack>
    )

    return (
      <div className="eventStreamSectionBase sessionSectionBase">
        {eventContent}
      </div>
    )
  }
}
