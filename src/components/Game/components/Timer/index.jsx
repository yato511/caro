import React from "react";
import { useEventTime } from "@/hooks/useEvent";
import { useSelector } from "react-redux";
import { useState } from "react";
import { useEffect } from "react";

const Timer = (props) => {
	const { roomInfo: { time = 0 } = {} } = useSelector((state) => state.room);
	const [count, setCount] = useState(time);

	useEffect(() => {
		const counter = setInterval(() => {
			setCount((count) => count - 1);
		}, 1000);
		useEventTime.removeAllListeners();
		useEventTime.on("set-time", () => {
			setCount(time);
			handleResetOverTime();
		});
		return () => {
			clearInterval(counter);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (count === 0) {
			handleOverTime();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [count]);

	const handleOverTime = (e) => {
		props.setIsOverTime(true);
	};

	const handleResetOverTime = (e) => {
		props.setIsOverTime(false);
	};

	return <div>{count}</div>;
};

export default Timer;
