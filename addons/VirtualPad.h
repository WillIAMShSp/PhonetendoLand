/**
 * @file VirtualPad.h
 * @author Luis Camilo Alvarez Carrau
 * @brief Class definition for a virtual game pad.
 * @version 0.1
 * @date 2026-07-18
 */

#pragma once

#define WIN32_LEAN_AND_MEAN  
#include <windows.h>

#include <string>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>


#include <napi.h>
#include <ViGEm/Client.h>

#pragma comment(lib, "setupapi.lib")

struct ControllerInput {

    USHORT buttonMask;
    bool pressState;

};


class VirtualPad : public Napi::ObjectWrap<VirtualPad>
{
public:
    VirtualPad(const Napi::CallbackInfo& info);
    
    Napi::Value test(const Napi::CallbackInfo& info);
    Napi::Value startController(const Napi::CallbackInfo& info);
    Napi::Value sendInput(const Napi::CallbackInfo& info);
    Napi::Value endController(const Napi::CallbackInfo& info);

    static Napi::Function GetClass(Napi::Env env);
    

    std::atomic<bool>& getPadActive();
    std::thread& getPadThread();


private:
    
    std::string playerId;
    std::thread m_thread;
    std::atomic<bool> g_padActive;
    std::queue<ControllerInput> g_controllerInputQueue;
    std::mutex g_mutex;

    void injectInput(ControllerInput input);

    PVIGEM_CLIENT m_client;
    PVIGEM_TARGET m_pad;

    USHORT g_buttonStates = 0;
    void inputPollLoop();
    
};

void throwError(Napi::Env& env, const char* message);

void TestThreaded(std::atomic<bool>& active);

