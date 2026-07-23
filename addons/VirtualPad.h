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

#include <iostream>
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

struct RumbleContext {
    RumbleContext(Napi::Env env) :deferred(Napi::Promise::Deferred::New(env)) {
        std::cout<< "\nRumble Context Created!\n";
    }

    Napi::Promise::Deferred deferred;
    Napi::ThreadSafeFunction tsfn;
    std::string padSocket;
};



VOID CALLBACK RumbleCallback(PVIGEM_CLIENT Client, PVIGEM_TARGET Target, UCHAR LargeMotor, UCHAR SmallMotor, UCHAR LedNumber, LPVOID UserData) {
    RumbleContext* rumbleContext = (RumbleContext*)UserData;
    
    const auto callback = [](Napi::Env env, Napi::Function jsCallback, std::string* socket){
        jsCallback.Call({Napi::String::New(env, socket->c_str())});
    };


    napi_status status = rumbleContext->tsfn.BlockingCall(&rumbleContext->padSocket,callback);
    if (status != napi_ok) {
        std::cout<< "Failed to make blocking call";
    }



}

class VirtualPad : public Napi::ObjectWrap<VirtualPad>
{
public:
    VirtualPad(const Napi::CallbackInfo& info);
    ~VirtualPad();

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

    // Napi::Env m_env;
    // napi_handle_scope m_scope;

    RumbleContext m_rumbleContext;
    void startControllerRumbleContext(Napi::Env& env);
    
   
    


};

void throwError(Napi::Env& env, const char* message);

void TestThreaded(std::atomic<bool>& active);

void testEnvs(Napi::Env env);


void finalizeCallBack(Napi::Env env, void* finalizeData, RumbleContext* context);
