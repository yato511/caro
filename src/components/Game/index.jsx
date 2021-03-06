import actionRefresh from "@/actions/actionRefresh";
import {
	actionClick,
	actionRefreshGame,
	actionRequest,
	actionSaveGame,
	actionSetDraw,
	actionSetSurrender,
	actionSetWinner,
} from "@/actions/gameActions";
import { setIsJoinGame, setTime } from "@/actions/room";
import GameSocket from "@/components/Game/components/GameSocket";
import Config from "@/constants/configs";
import useAuth from "@/hooks/useAuth";
import useAxios from "@/hooks/useAxios";
import { useEventClick, useEventTime } from "@/hooks/useEvent";
import useSocket from "@/hooks/useSocket";
import { playerColorMapping } from "@/pages/GameReplay/mapping";
import { Avatar, Button, Modal, Tag } from "antd";
import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import { useHistory } from "react-router-dom";
import { bindActionCreators } from "redux";
import Board from "./components/Board";
import Chat from "./components/Chat";
import Status from "./components/Status";
import Timer from "./components/Timer";
import "./styles.scss";

const Game = (props) => {
	const { user } = useAuth();
	const axios = useAxios();
	const { push } = useHistory();
	const socket = useSocket();

	const { actions } = props;
	const { history } = props;
	const { stepNumber } = props;
	const { nextMove } = props;
	const { winCells } = props;
	const { roomInfo } = props;
	const { message } = props;
	const { isSaveGame } = props;
	// const { isFetching } = props;
	const { chatHistory } = props;
	const { isSurrender } = props;
	const { isDraw } = props;
	const { winner } = props;
	const { isJoinGame } = props;

	const [isEndGame, setIsEndGame] = useState(false);
	const [isOverTime, setIsOverTime] = useState(false);

	useEventClick.removeAllListeners();

	useEventClick.on("add-new-move", (data) => {
		handleClick(data.row, data.col);
		useEventClick.removeAllListeners();
	});

	const setupSocket = () => {
		socket.off("refresh-game-request");
		socket.off("refresh-game-result");
		socket.off("draw-request");
		socket.off("draw-result");
		socket.off("surrender-request");
		socket.off("surrender-result");

		// Play again
		socket.on("refresh-game-request", (data) => {
			Modal.confirm({
				title: "Đối thủ muốn chơi lại !",
				onOk: () => {
					socket.emit("refresh-game-result", {
						message: "yes",
						nextMove: data,
					});
					actions.actionRefreshGame(data);
					useEventTime.emit("set-time");
				},
				onCancel: () => {
					socket.emit("refresh-game-result", {
						message: "no",
					});
				},
			});
		});

		socket.on("refresh-game-result", (data) => {
			if (data.message === "yes") {
				actions.actionRefreshGame(data.nextMove);
				useEventTime.emit("set-time");
				Modal.success({ title: "Đối thủ đã đồng ý!" });
			} else {
				Modal.warning({ title: "Đối thủ không đồng ý!" });
			}
		});

		// Surrender
		socket.on("surrender-request", () => {
			socket.emit("surrender-result");
			actions.actionRequest(true, `Đối thủ đầu hàng, bạn đã thắng !`);
			const winner = isPlayerX ? Config.xPlayer : Config.oPlayer;
			actions.actionSetWinner(winner);
			actions.actionSetSurrender(true);
		});

		socket.on("surrender-result", () => {
			actions.actionRequest(true, `Bạn đã đầu hàng !`);
			const winner = isPlayerX ? Config.oPlayer : Config.xPlayer;
			actions.actionSetWinner(winner);
			actions.actionSetSurrender(true);
		});

		//Draw
		socket.on("draw-request", () => {
			Modal.confirm({
				title: "Đối thủ xin hoà trận đấu !",
				onOk: () => {
					socket.emit("draw-result", {
						message: "yes",
					});
					actions.actionRequest(true, `Chấp nhận hoà !`);
					const winner = isPlayerX ? Config.oPlayer : Config.xPlayer;
					actions.actionSetWinner(winner);
					actions.actionSetDraw(true);
				},
				onCancel: () => {
					socket.emit("draw-result", {
						message: "no",
					});
					actions.actionRequest(false, null);
				},
			});
		});

		socket.on("draw-result", (data) => {
			if (data.message === "yes") {
				actions.actionRequest(true, `Đối thủ đã chấp nhận hoà !`);
				Modal.success({ title: "Đối thủ đã chấp nhận hoà!" });
				const winner = isPlayerX ? Config.xPlayer : Config.oPlayer;
				actions.actionSetWinner(winner);
				actions.actionSetDraw(true);
			} else {
				actions.actionRequest(false, null);
				Modal.warning({ title: "Đối thủ đã từ chối hoà!" });
			}
		});
	};

	const doConfirm = (message, callbackYes, callbackNo) => {
		Modal.confirm({
			title: "Xác nhận",
			content: message,
			onOk: callbackYes,
			onCancel: callbackNo,
		});
	};

	const requestSurrender = () => {
		doConfirm(
			"Bạn muốn đầu hàng ván này ?",
			() => {
				socket.emit("surrender-request");
			},
			() => {}
		);
	};

	const requestDraw = () => {
		doConfirm(
			"Bạn muốn xin hoà trận đấu ?",
			() => {
				socket.emit("draw-request");
				actions.actionRequest(true, `Đang xin hoà...!`);
			},
			() => {}
		);
	};

	const requestRefreshGame = () => {
		const nextMove =
			winner === Config.xPlayer ? Config.oPlayer : Config.xPlayer;
		console.log("winner: " + winner);
		console.log("Next move: " + nextMove);
		doConfirm(
			"Bạn muốn chơi lại ?",
			() => {
				socket.emit("refresh-game-request", nextMove);
				actions.actionRequest(true, `Đang xin chơi lại...!`);
			},
			() => {}
		);
	};

	setupSocket();

	const current = history[stepNumber];

	var isPlayerX = roomInfo.players.X && user.sub === roomInfo.players.X.sub;

	const rival = isPlayerX ? roomInfo.players.O : roomInfo.players.X;

	useEffect(() => {
		let calculateWinner = null;

		const isOnePlayerDisconnected =
			roomInfo.players.O.name === "DISCONNECTED" ||
			roomInfo.players.X.name === "DISCONNECTED";

		const isEndGame =
			isOnePlayerDisconnected ||
			isOverTime ||
			winCells ||
			isSurrender ||
			isDraw;

		setIsEndGame(isEndGame);

		const saveGame = () => {
			console.log("save game: " + calculateWinner);
			let isWinner = false;

			if (
				(calculateWinner === Config.xPlayer && isPlayerX) ||
				(calculateWinner === Config.oPlayer && !isPlayerX)
			) {
				isWinner = true;
			}
			if (isWinner) {
				console.log(history);
				console.log(chatHistory);
				console.log(winCells);
				if (!isDraw) console.log("winner sub: " + user.sub);
				else console.log("DRAW");

				axios
					.post("/games/save", {
						xPlayer: {
							sub: isPlayerX ? user.sub : rival.sub,
							displayName: isPlayerX ? user.displayName : rival.displayName,
							picture: isPlayerX ? user.picture : rival.picture,
						},
						oPlayer: {
							sub: !isPlayerX ? user.sub : rival.sub,
							displayName: !isPlayerX ? user.displayName : rival.displayName,
							picture: !isPlayerX ? user.picture : rival.picture,
						},
						history,
						chatHistory,
						winCells,
						isDraw,
						winner: isDraw ? null : user.sub,
						date: new Date(),
					})
					.then((res) => {
						console.log(res.data);
					});
			}
			actions.actionSaveGame();
		};

		if (isEndGame) {
			console.log("end game");
			if (winCells || isOverTime) {
				calculateWinner =
					nextMove === Config.xPlayer ? Config.oPlayer : Config.xPlayer;
				actions.actionSetWinner(calculateWinner);
			} else if (isOnePlayerDisconnected) {
				calculateWinner =
					roomInfo.players.X.name === "DISCONNECTED"
						? Config.oPlayer
						: Config.xPlayer;
				actions.actionSetWinner(calculateWinner);
			} else if (isSurrender) {
				calculateWinner = winner;
			} else if (isDraw && winner) {
				calculateWinner = winner;
			}

			if (!isSaveGame && calculateWinner) {
				saveGame();
			}

			if (isSaveGame === true && isJoinGame === false) {
				push("/");
			}
		}
	}, [
		roomInfo,
		isOverTime,
		winCells,
		nextMove,
		history,
		isPlayerX,
		isSaveGame,
		actions,
		user,
		rival,
		isDraw,
		isSurrender,
		winner,
		chatHistory,
		axios,
		isJoinGame,
		push,
	]);

	const exitGame = () => {
		actions.actionRefreshGame("X");
		actions.setIsJoinGame(false);
		actions.actionRefresh();
		socket.emit("out-game");
	};

	const checkWin = (row, col, user, stepNumber) => {
		if (stepNumber === 0) {
			return null;
		}

		const { history } = props;
		const current = history[stepNumber];
		const squares = current.squares.slice();

		let coorX = row;
		let coorY = col;

		let countCol = 1;
		let countRow = 1;
		let countMainDiagonal = 1;
		let countSkewDiagonal = 1;
		let isBlock;
		const rival = user === Config.xPlayer ? Config.oPlayer : Config.xPlayer;

		isBlock = true;
		let winCells = [];
		coorX -= 1;
		while (coorX >= 0 && squares[coorX][coorY] === user) {
			countCol += 1;
			winCells.push({ coorX, coorY });
			coorX -= 1;
		}
		if (coorX >= 0 && squares[coorX][coorY] !== rival) {
			isBlock = false;
		}
		coorX = row;
		winCells.push({ coorX, coorY });
		coorX += 1;
		while (coorX <= Config.brdSize - 1 && squares[coorX][coorY] === user) {
			countCol += 1;
			winCells.push({ coorX, coorY });
			coorX += 1;
		}
		if (coorX <= Config.brdSize - 1 && squares[coorX][coorY] !== rival) {
			isBlock = false;
		}
		coorX = row;
		if (isBlock === false && countCol >= 5) return winCells;

		isBlock = true;
		winCells = [];
		coorY -= 1;
		while (coorY >= 0 && squares[coorX][coorY] === user) {
			countRow += 1;
			winCells.push({ coorX, coorY });
			coorY -= 1;
		}
		if (coorY >= 0 && squares[coorX][coorY] !== rival) {
			isBlock = false;
		}
		coorY = col;
		winCells.push({ coorX, coorY });
		coorY += 1;
		while (coorY <= Config.brdSize - 1 && squares[coorX][coorY] === user) {
			countRow += 1;
			winCells.push({ coorX, coorY });
			coorY += 1;
		}
		if (coorY <= Config.brdSize - 1 && squares[coorX][coorY] !== rival) {
			isBlock = false;
		}
		coorY = col;
		if (isBlock === false && countRow >= 5) return winCells;

		isBlock = true;
		winCells = [];
		coorX -= 1;
		coorY -= 1;
		while (coorX >= 0 && coorY >= 0 && squares[coorX][coorY] === user) {
			countMainDiagonal += 1;
			winCells.push({ coorX, coorY });
			coorX -= 1;
			coorY -= 1;
		}
		if (coorX >= 0 && coorY >= 0 && squares[coorX][coorY] !== rival) {
			isBlock = false;
		}
		coorX = row;
		coorY = col;
		winCells.push({ coorX, coorY });
		coorX += 1;
		coorY += 1;
		while (
			coorX <= Config.brdSize - 1 &&
			coorY <= Config.brdSize - 1 &&
			squares[coorX][coorY] === user
		) {
			countMainDiagonal += 1;
			winCells.push({ coorX, coorY });
			coorX += 1;
			coorY += 1;
		}
		if (
			coorX <= Config.brdSize - 1 &&
			coorY <= Config.brdSize - 1 &&
			squares[coorX][coorY] !== rival
		) {
			isBlock = false;
		}
		coorX = row;
		coorY = col;
		if (isBlock === false && countMainDiagonal >= 5) return winCells;

		isBlock = true;
		winCells = [];
		coorX -= 1;
		coorY += 1;
		while (coorX >= 0 && coorY >= 0 && squares[coorX][coorY] === user) {
			countSkewDiagonal += 1;
			winCells.push({ coorX, coorY });
			coorX -= 1;
			coorY += 1;
		}
		if (coorX >= 0 && coorY >= 0 && squares[coorX][coorY] !== rival) {
			isBlock = false;
		}
		coorX = row;
		coorY = col;
		winCells.push({ coorX, coorY });
		coorX += 1;
		coorY -= 1;
		while (
			coorX <= Config.brdSize - 1 &&
			coorY <= Config.brdSize - 1 &&
			squares[coorX][coorY] === user
		) {
			countSkewDiagonal += 1;
			winCells.push({ coorX, coorY });
			coorX += 1;
			coorY -= 1;
		}
		if (
			coorX <= Config.brdSize - 1 &&
			coorY <= Config.brdSize - 1 &&
			squares[coorX][coorY] !== rival
		) {
			isBlock = false;
		}
		if (isBlock === false && countSkewDiagonal >= 5) return winCells;

		return null;
	};

	const userClick = (row, col) => {
		const { nextMove } = props;

		if (isEndGame) {
			return;
		}

		if (
			(isPlayerX && nextMove === Config.oPlayer) ||
			(!isPlayerX && nextMove === Config.xPlayer)
		) {
			return;
		}

		if (handleClick(row, col)) {
			socket.emit("move", { row: row, col: col });
		}
	};

	const handleClick = (row, col) => {
		const { actions } = props;
		const { stepNumber } = props;
		const { history } = props;
		const { nextMove } = props;
		const { winCells } = props;

		const curMove = nextMove;
		const newHistory = history.slice(0, stepNumber + 1);
		const current = newHistory[newHistory.length - 1];

		const squares = JSON.parse(JSON.stringify(current.squares));

		if (winCells == null && squares[row][col] == null) {
			squares[row][col] = curMove;
			const _nextMove =
				curMove === Config.xPlayer ? Config.oPlayer : Config.xPlayer;
			const _winCells = checkWin(row, col, curMove, newHistory.length - 1);
			const _history = newHistory.concat([
				{
					x: row,
					y: col,
					squares,
				},
			]);

			actions.actionClick(_history, _nextMove, _winCells);
			useEventTime.emit("set-time");

			return true;
		}
		return false;
	};

	return (
		<div className="Game">
			<Status
				nextMove={nextMove}
				winCells={winCells}
				rivalName={rival.name}
				messages={message}
				isPlayerX={isPlayerX}
				isOverTime={isOverTime}
				winner={winner}
			/>
			<div className="board-game">
				<div>
					<div className="player-single-wrapper">
						<Tag color={playerColorMapping[isPlayerX ? `X` : `O`]}>
							Bạn là {isPlayerX ? `X` : `O`}
						</Tag>
						<Avatar src={user.picture} size={100} />
						<h3 style={{ color: playerColorMapping[isPlayerX ? `X` : `O`] }}>
							{user.displayName}
						</h3>
						<div className="btns">
							<Button type="primary" danger onClick={() => exitGame()}>
								Thoát game
							</Button>
							{isEndGame && rival.name !== "DISCONNECTED" && (
								<Button type="primary" onClick={() => requestRefreshGame()}>
									Đấu lại
								</Button>
							)}
						</div>
					</div>
					{/* <Card className="card">
						<Card.Body className="card-body">
							<Card.Title className="card-title">
								Bạn là {isPlayerX ? `X` : `O`}
							</Card.Title>
							<Card.Text className="card-text-bold">
								<b>{user.displayName}</b>
							</Card.Text>
							<img src={user.picture} className="avatar-small" alt="avatar" />
							<br></br>
						</Card.Body>
						<Button
							className="logout-button"
							variant="danger"
							onClick={() => exitGame()}
						>
							Thoát game
						</Button>
						{isEndGame && rival.name !== "DISCONNECTED" && (
							<Button
								className="logout-button"
								variant="danger"
								onClick={() => requestRefreshGame()}
							>
								Đấu lại
							</Button>
						)}
					</Card>
					<br></br> */}
					{/* <Card className="card">
            <Card.Body className="card-body">
              <Card.Title className="card-title">
                Đối thủ là {!isPlayerX ? `X` : `O`}
              </Card.Title>
              <Card.Text className="card-text-bold">
                <b>{rival.name}</b>
              </Card.Text>
              <img
                src={
                  rival.name !== "DISCONNECTED"
                    ? rival.picture
                    : Config.defaultAvatar
                }
                className="avatar-small"
                alt="rivalAvatar"
              />
              <br></br>
            </Card.Body>
            {!isEndGame && rival.name !== "DISCONNECTED" && (
              <Button
                className="logout-button"
                variant="danger"
                onClick={() => requestDraw()}
              >
                Cầu hoà
              </Button>
            )}
            {!isEndGame && rival.name !== "DISCONNECTED" && (
              <Button
                className="logout-button"
                variant="danger"
                onClick={() => requestSurrender()}
              >
                Xin thua
              </Button>
            )}
          </Card> */}
					<div className="player-single-wrapper">
						<Tag color={playerColorMapping[!isPlayerX ? `X` : `O`]}>
							Đối thủ là {!isPlayerX ? `X` : `O`}
						</Tag>
						<Avatar
							src={
								rival.name !== "DISCONNECTED"
									? rival.picture
									: Config.defaultAvatar
							}
							size={100}
						/>
						<h3 style={{ color: playerColorMapping[!isPlayerX ? `X` : `O`] }}>
							{rival.name}
						</h3>
						<div className="btns">
							{!isEndGame && rival.name !== "DISCONNECTED" && (
								<Button danger onClick={() => requestDraw()}>
									Cầu hoà
								</Button>
							)}
							{!isEndGame && rival.name !== "DISCONNECTED" && (
								<Button
									danger
									type="primary"
									onClick={() => requestSurrender()}
								>
									Xin thua
								</Button>
							)}
						</div>
					</div>
				</div>
				<div>
					<Board
						winCells={winCells}
						squares={current.squares}
						currentCell={[current.x, current.y]}
						handleClick={(i, j) => userClick(i, j)}
					/>
				</div>
				<div>
					{!isEndGame && <Timer setIsOverTime={setIsOverTime} />}
					<Chat socket={socket} rivalName={rival.displayName} />
				</div>
			</div>
			{socket && <GameSocket />}
		</div>
	);
};

const mapStateToProps = (state) => {
	return {
		history: state.game.data.history,
		nextMove: state.game.data.nextMove,
		stepNumber: state.game.data.stepNumber,
		winCells: state.game.data.winCells,
		message: state.game.message,
		roomInfo: state.room.roomInfo,
		isSaveGame: state.game.data.isSaveGame,
		isSurrender: state.game.data.isSurrender,
		isDraw: state.game.data.isDraw,
		winner: state.game.data.winner,
		// isFetching: state.game.isFetching,
		chatHistory: state.game.data.chatHistory,
		isJoinGame: state.room.isJoinGame,
	};
};

const mapDispatchToProps = (dispatch) => {
	return {
		actions: bindActionCreators(
			{
				actionClick,
				actionRefreshGame,
				actionSaveGame,
				actionRequest,
				setTime,
				actionSetSurrender,
				actionSetDraw,
				actionSetWinner,
				setIsJoinGame,
				actionRefresh,
			},
			dispatch
		),
	};
};

export default connect(mapStateToProps, mapDispatchToProps)(Game);
